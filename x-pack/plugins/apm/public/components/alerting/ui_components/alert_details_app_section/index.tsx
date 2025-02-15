/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiFlexGroup, EuiFlexItem, EuiSpacer } from '@elastic/eui';
import { FormattedMessage } from '@kbn/i18n-react';
import { formatAlertEvaluationValue } from '@kbn/observability-plugin/public';
import {
  ALERT_DURATION,
  ALERT_END,
  ALERT_EVALUATION_THRESHOLD,
  ALERT_EVALUATION_VALUE,
  ALERT_RULE_TYPE_ID,
  ALERT_RULE_UUID,
} from '@kbn/rule-data-utils';
import moment from 'moment';
import React, { useEffect, useMemo } from 'react';
import { useKibana } from '@kbn/kibana-react-plugin/public';
import { toMicroseconds as toMicrosecondsUtil } from '../../../../../common/utils/formatters';
import { SERVICE_ENVIRONMENT } from '../../../../../common/es_fields/apm';
import { ChartPointerEventContextProvider } from '../../../../context/chart_pointer_event/chart_pointer_event_context';
import { TimeRangeMetadataContextProvider } from '../../../../context/time_range_metadata/time_range_metadata_context';
import { useTimeRange } from '../../../../hooks/use_time_range';
import { getComparisonChartTheme } from '../../../shared/time_comparison/get_comparison_chart_theme';
import FailedTransactionChart from './failed_transaction_chart';
import { getAggsTypeFromRule } from './helpers';
import { LatencyAlertsHistoryChart } from './latency_alerts_history_chart';
import LatencyChart from './latency_chart/latency_chart';
import ThroughputChart from './throughput_chart';
import {
  AlertDetailsAppSectionProps,
  SERVICE_NAME,
  TRANSACTION_TYPE,
} from './types';

const toMicroseconds = (value?: number) =>
  value ? toMicrosecondsUtil(value, 'milliseconds') : value;

export function AlertDetailsAppSection({
  rule,
  alert,
  timeZone,
  setAlertSummaryFields,
}: AlertDetailsAppSectionProps) {
  useEffect(() => {
    const alertSummaryFields = [
      {
        label: (
          <FormattedMessage
            id="xpack.apm.pages.alertDetails.alertSummary.actualValue"
            defaultMessage="Actual value"
          />
        ),
        value: formatAlertEvaluationValue(
          alert?.fields[ALERT_RULE_TYPE_ID],
          alert?.fields[ALERT_EVALUATION_VALUE]
        ),
      },
      {
        label: (
          <FormattedMessage
            id="xpack.apm.pages.alertDetails.alertSummary.expectedValue"
            defaultMessage="Expected value"
          />
        ),
        value: formatAlertEvaluationValue(
          alert?.fields[ALERT_RULE_TYPE_ID],
          toMicroseconds(alert?.fields[ALERT_EVALUATION_THRESHOLD])
        ),
      },
      {
        label: (
          <FormattedMessage
            id="xpack.apm.pages.alertDetails.alertSummary.serviceEnv"
            defaultMessage="Service environment"
          />
        ),
        value: alert?.fields[SERVICE_ENVIRONMENT],
      },
      {
        label: (
          <FormattedMessage
            id="xpack.apm.pages.alertDetails.alertSummary.serviceName"
            defaultMessage="Service name"
          />
        ),
        value: alert?.fields[SERVICE_NAME],
      },
    ];
    setAlertSummaryFields(alertSummaryFields);
  }, [alert?.fields, setAlertSummaryFields]);

  const params = rule.params;
  const environment = alert.fields[SERVICE_ENVIRONMENT];
  const latencyAggregationType = getAggsTypeFromRule(params.aggregationType);

  // duration is us, convert it to MS
  const alertDurationMS = alert.fields[ALERT_DURATION]! / 1000;

  const serviceName = String(alert.fields[SERVICE_NAME]);

  // Currently, we don't use comparisonEnabled nor offset.
  // But providing them as they are required for the chart.
  const comparisonEnabled = false;
  const offset = '1d';
  const ruleWindowSizeMS = moment
    .duration(rule.params.windowSize, rule.params.windowUnit)
    .asMilliseconds();

  const TWENTY_TIMES_RULE_WINDOW_MS = 20 * ruleWindowSizeMS;
  /**
   * This is part or the requirements (RFC).
   * If the alert is less than 20 units of `FOR THE LAST <x> <units>` then we should draw a time range of 20 units.
   * IE. The user set "FOR THE LAST 5 minutes" at a minimum we should show 100 minutes.
   */
  const rangeFrom =
    alertDurationMS < TWENTY_TIMES_RULE_WINDOW_MS
      ? moment(alert.start)
          .subtract(TWENTY_TIMES_RULE_WINDOW_MS, 'millisecond')
          .toISOString()
      : moment(alert.start)
          .subtract(ruleWindowSizeMS, 'millisecond')
          .toISOString();

  const rangeTo = alert.active
    ? // Add one minute to chart range to ensure that the active alert annotation is shown when seconds are involved.
      moment().add(1, 'minute').toISOString()
    : moment(alert.fields[ALERT_END])
        .add(ruleWindowSizeMS, 'millisecond')
        .toISOString();

  const { start, end } = useTimeRange({ rangeFrom, rangeTo });
  const transactionType = alert.fields[TRANSACTION_TYPE];
  const comparisonChartTheme = getComparisonChartTheme();

  const {
    services: { uiSettings },
  } = useKibana();

  const historicalRange = useMemo(() => {
    return {
      start: moment().subtract(30, 'days').toISOString(),
      end: moment().toISOString(),
    };
  }, []);

  return (
    <EuiFlexGroup direction="column" gutterSize="s">
      <TimeRangeMetadataContextProvider
        start={start}
        end={end}
        kuery=""
        useSpanName={false}
        uiSettings={uiSettings!}
      >
        <ChartPointerEventContextProvider>
          <EuiFlexItem>
            <LatencyChart
              alert={alert}
              transactionType={transactionType}
              serviceName={serviceName}
              environment={environment}
              start={start}
              end={end}
              comparisonChartTheme={comparisonChartTheme}
              timeZone={timeZone}
              latencyAggregationType={latencyAggregationType}
              comparisonEnabled={comparisonEnabled}
              offset={offset}
            />
            <EuiSpacer size="s" />
            <EuiFlexGroup direction="row" gutterSize="s">
              <ThroughputChart
                transactionType={transactionType}
                serviceName={serviceName}
                environment={environment}
                start={start}
                end={end}
                comparisonChartTheme={comparisonChartTheme}
                comparisonEnabled={comparisonEnabled}
                offset={offset}
                timeZone={timeZone}
              />
              <FailedTransactionChart
                transactionType={transactionType}
                serviceName={serviceName}
                environment={environment}
                start={start}
                end={end}
                comparisonChartTheme={comparisonChartTheme}
                timeZone={timeZone}
              />
            </EuiFlexGroup>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <LatencyAlertsHistoryChart
              ruleId={alert.fields[ALERT_RULE_UUID]}
              serviceName={serviceName}
              start={historicalRange.start}
              end={historicalRange.end}
              transactionType={transactionType}
              latencyAggregationType={latencyAggregationType}
              environment={environment}
              timeZone={timeZone}
            />
          </EuiFlexItem>
        </ChartPointerEventContextProvider>
      </TimeRangeMetadataContextProvider>
    </EuiFlexGroup>
  );
}

// eslint-disable-next-line import/no-default-export
export default AlertDetailsAppSection;
