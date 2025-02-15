/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import numeral from '@elastic/numeral';
import {
  ALERT_EVALUATION_THRESHOLD,
  ALERT_EVALUATION_VALUE,
  ALERT_REASON,
} from '@kbn/rule-data-utils';
import { LifecycleRuleExecutor } from '@kbn/rule-registry-plugin/server';
import { ExecutorType } from '@kbn/alerting-plugin/server';
import { addSpaceIdToPath } from '@kbn/spaces-plugin/server';
import { IBasePath } from '@kbn/core/server';

import { SLO_ID_FIELD, SLO_REVISION_FIELD } from '../../../../common/field_names/infra_metrics';
import { Duration, toDurationUnit } from '../../../domain/models';
import { DefaultSLIClient, KibanaSavedObjectsSLORepository } from '../../../services/slo';
import { computeBurnRate } from '../../../domain/services';
import {
  AlertStates,
  BurnRateAlertContext,
  BurnRateAlertState,
  BurnRateAllowedActionGroups,
  BurnRateRuleParams,
  BurnRateRuleTypeState,
} from './types';

const SHORT_WINDOW = 'SHORT_WINDOW';
const LONG_WINDOW = 'LONG_WINDOW';

export const getRuleExecutor = ({
  basePath,
}: {
  basePath: IBasePath;
}): LifecycleRuleExecutor<
  BurnRateRuleParams,
  BurnRateRuleTypeState,
  BurnRateAlertState,
  BurnRateAlertContext,
  BurnRateAllowedActionGroups
> =>
  async function executor({
    services,
    params,
    startedAt,
    spaceId,
  }): ReturnType<
    ExecutorType<
      BurnRateRuleParams,
      BurnRateRuleTypeState,
      BurnRateAlertState,
      BurnRateAlertContext,
      BurnRateAllowedActionGroups
    >
  > {
    const {
      alertWithLifecycle,
      savedObjectsClient: soClient,
      scopedClusterClient: esClient,
      alertFactory,
    } = services;

    const sloRepository = new KibanaSavedObjectsSLORepository(soClient);
    const summaryClient = new DefaultSLIClient(esClient.asCurrentUser);
    const slo = await sloRepository.findById(params.sloId);

    if (!slo.enabled) {
      return { state: {} };
    }

    const longWindowDuration = new Duration(
      params.longWindow.value,
      toDurationUnit(params.longWindow.unit)
    );
    const shortWindowDuration = new Duration(
      params.shortWindow.value,
      toDurationUnit(params.shortWindow.unit)
    );

    const sliData = await summaryClient.fetchSLIDataFrom(slo, [
      { name: LONG_WINDOW, duration: longWindowDuration.add(slo.settings.syncDelay) },
      { name: SHORT_WINDOW, duration: shortWindowDuration.add(slo.settings.syncDelay) },
    ]);

    const longWindowBurnRate = computeBurnRate(slo, sliData[LONG_WINDOW]);
    const shortWindowBurnRate = computeBurnRate(slo, sliData[SHORT_WINDOW]);

    const shouldAlert =
      longWindowBurnRate >= params.burnRateThreshold &&
      shortWindowBurnRate >= params.burnRateThreshold;

    const viewInAppUrl = addSpaceIdToPath(
      basePath.publicBaseUrl,
      spaceId,
      `/app/observability/slos/${slo.id}`
    );

    if (shouldAlert) {
      const reason = buildReason(
        longWindowDuration,
        longWindowBurnRate,
        shortWindowDuration,
        shortWindowBurnRate,
        params
      );

      const context = {
        longWindow: { burnRate: longWindowBurnRate, duration: longWindowDuration.format() },
        reason,
        shortWindow: { burnRate: shortWindowBurnRate, duration: shortWindowDuration.format() },
        burnRateThreshold: params.burnRateThreshold,
        timestamp: startedAt.toISOString(),
        viewInAppUrl,
        sloId: slo.id,
        sloName: slo.name,
      };

      const alert = alertWithLifecycle({
        id: `alert-${slo.id}-${slo.revision}`,
        fields: {
          [ALERT_REASON]: reason,
          [ALERT_EVALUATION_THRESHOLD]: params.burnRateThreshold,
          [ALERT_EVALUATION_VALUE]: Math.min(longWindowBurnRate, shortWindowBurnRate),
          [SLO_ID_FIELD]: slo.id,
          [SLO_REVISION_FIELD]: slo.revision,
        },
      });

      alert.scheduleActions(ALERT_ACTION.id, context);
      alert.replaceState({ alertState: AlertStates.ALERT });
    }

    const { getRecoveredAlerts } = alertFactory.done();
    const recoveredAlerts = getRecoveredAlerts();
    for (const recoveredAlert of recoveredAlerts) {
      const context = {
        longWindow: { burnRate: longWindowBurnRate, duration: longWindowDuration.format() },
        shortWindow: { burnRate: shortWindowBurnRate, duration: shortWindowDuration.format() },
        burnRateThreshold: params.burnRateThreshold,
        timestamp: startedAt.toISOString(),
        viewInAppUrl,
        sloId: slo.id,
        sloName: slo.name,
      };

      recoveredAlert.setContext(context);
    }

    return { state: {} };
  };

const ALERT_ACTION_ID = 'slo.burnRate.alert';
export const ALERT_ACTION = {
  id: ALERT_ACTION_ID,
  name: i18n.translate('xpack.observability.slo.alerting.burnRate.alertAction', {
    defaultMessage: 'Alert',
  }),
};

function buildReason(
  longWindowDuration: Duration,
  longWindowBurnRate: number,
  shortWindowDuration: Duration,
  shortWindowBurnRate: number,
  params: BurnRateRuleParams
) {
  return i18n.translate('xpack.observability.slo.alerting.burnRate.reason', {
    defaultMessage:
      'The burn rate for the past {longWindowDuration} is {longWindowBurnRate} and for the past {shortWindowDuration} is {shortWindowBurnRate}. Alert when above {burnRateThreshold} for both windows',
    values: {
      longWindowDuration: longWindowDuration.format(),
      longWindowBurnRate: numeral(longWindowBurnRate).format('0.[00]'),
      shortWindowDuration: shortWindowDuration.format(),
      shortWindowBurnRate: numeral(shortWindowBurnRate).format('0.[00]'),
      burnRateThreshold: params.burnRateThreshold,
    },
  });
}
