/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import {
  EuiLoadingLogo,
  EuiEmptyPrompt,
  EuiIcon,
  EuiMarkdownFormat,
  EuiButton,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiImage,
} from '@elastic/eui';
import { FormattedHTMLMessage, FormattedMessage } from '@kbn/i18n-react';
import { i18n } from '@kbn/i18n';
import { css } from '@emotion/react';
import { VULN_MGMT_POLICY_TEMPLATE } from '../../common/constants';
import { FullSizeCenteredPage } from './full_size_centered_page';
import { CloudPosturePage } from './cloud_posture_page';
import { useCspSetupStatusApi } from '../common/api/use_setup_status_api';
import type { IndexDetails } from '../../common/types';
import { NO_VULNERABILITIES_STATUS_TEST_SUBJ } from './test_subjects';
import noDataIllustration from '../assets/illustrations/no_data_illustration.svg';
import { useCspIntegrationLink } from '../common/navigation/use_csp_integration_link';
import { useCISIntegrationPoliciesLink } from '../common/navigation/use_navigate_to_cis_integration_policies';
import { useCspBenchmarkIntegrations } from '../pages/benchmarks/use_csp_benchmark_integrations';

const REFETCH_INTERVAL_MS = 20000;

const ScanningVulnerabilitiesEmptyPrompt = () => (
  <EuiEmptyPrompt
    data-test-subj={NO_VULNERABILITIES_STATUS_TEST_SUBJ.SCANNING_VULNERABILITIES}
    color="plain"
    icon={<EuiLoadingLogo logo="logoSecurity" size="xl" />}
    title={
      <h2>
        <FormattedMessage
          id="xpack.csp.noVulnerabilitiesStates.scanningVulnerabilitiesEmptyPrompt.indexingButtonTitle"
          defaultMessage="Scanning your environment"
        />
      </h2>
    }
    body={
      <p>
        <FormattedMessage
          id="xpack.csp.noVulnerabilitiesStates.scanningVulnerabilitiesEmptyPrompt.indexingDescription"
          defaultMessage="Results will appear here as soon as they are available."
        />
      </p>
    }
  />
);

const CnvmIntegrationNotInstalledEmptyPrompt = ({
  vulnMgmtIntegrationLink,
}: {
  vulnMgmtIntegrationLink?: string;
}) => {
  return (
    <EuiEmptyPrompt
      data-test-subj={NO_VULNERABILITIES_STATUS_TEST_SUBJ.NOT_INSTALLED}
      icon={<EuiImage size="fullWidth" src={noDataIllustration} alt="no-data-illustration" />}
      title={
        <h2>
          <FormattedHTMLMessage
            tagName="h2"
            id="xpack.csp.cloudPosturePage.vulnerabilitiesInstalledEmptyPrompt.promptTitle"
            defaultMessage="Detect vulnerabilities in your <br/> cloud assets"
          />
        </h2>
      }
      layout="horizontal"
      color="plain"
      body={
        <p>
          <FormattedMessage
            id="xpack.csp.cloudPosturePage.vulnerabilitiesInstalledEmptyPrompt.promptDescription"
            defaultMessage="Add the Cloud Native Vulnerability Management integration to begin"
          />
        </p>
      }
      actions={
        <EuiFlexGroup>
          <EuiFlexItem grow={false}>
            <EuiButton color="primary" fill href={vulnMgmtIntegrationLink}>
              <FormattedMessage
                id="xpack.csp.cloudPosturePage.vulnerabilitiesInstalledEmptyPrompt.addVulMngtIntegrationButtonTitle"
                defaultMessage="Install Cloud Native Vulnerability Management"
              />
            </EuiButton>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty color="primary" href={'https://ela.st/cnvm'} target="_blank">
              <FormattedMessage
                id="xpack.csp.cloudPosturePage.vulnerabilitiesInstalledEmptyPrompt.learnMoreButtonTitle"
                defaultMessage="Learn more"
              />
            </EuiButtonEmpty>
          </EuiFlexItem>
        </EuiFlexGroup>
      }
    />
  );
};

const Unprivileged = ({ unprivilegedIndices }: { unprivilegedIndices: string[] }) => (
  <EuiEmptyPrompt
    data-test-subj={NO_VULNERABILITIES_STATUS_TEST_SUBJ.UNPRIVILEGED}
    color="plain"
    icon={<EuiIcon type="logoSecurity" size="xl" />}
    title={
      <h2>
        <FormattedMessage
          id="xpack.csp.noVulnerabilitiesStates.unprivileged.unprivilegedTitle"
          defaultMessage="Privileges required"
        />
      </h2>
    }
    body={
      <p>
        <FormattedMessage
          id="xpack.csp.noVulnerabilitiesStates.unprivileged.unprivilegedDescription"
          defaultMessage="To view cloud posture data, you must update privileges. For more information, contact your Kibana administrator."
        />
      </p>
    }
    footer={
      <EuiMarkdownFormat
        css={css`
          text-align: initial;
        `}
        children={
          i18n.translate(
            'xpack.csp.noVulnerabilitiesStates.unprivileged.unprivilegedFooterMarkdown',
            {
              defaultMessage:
                'Required Elasticsearch index privilege `read` for the following indices:',
            }
          ) + unprivilegedIndices.map((idx) => `\n- \`${idx}\``)
        }
      />
    }
  />
);
const AgentNotDeployedEmptyPrompt = () => {
  // using an existing hook to get agent id and package policy id
  const benchmarks = useCspBenchmarkIntegrations({
    name: '',
    page: 1,
    perPage: 1,
    sortField: 'package_policy.name',
    sortOrder: 'asc',
  });

  // the ids are not a must, but as long as we have them we can open the add agent flyout
  const firstBenchmark = benchmarks.data?.items?.[0];
  const integrationPoliciesLink = useCISIntegrationPoliciesLink({
    addAgentToPolicyId: firstBenchmark?.agent_policy.id || '',
    integration: firstBenchmark?.package_policy.id || '',
  });

  return (
    <EuiEmptyPrompt
      data-test-subj={NO_VULNERABILITIES_STATUS_TEST_SUBJ.NOT_DEPLOYED}
      color="plain"
      iconType="fleetApp"
      title={
        <h2>
          <FormattedMessage
            id="xpack.csp.noVulnerabilitiesStates.noAgentsDeployed.noAgentsDeployedTitle"
            defaultMessage="No Agents Installed"
          />
        </h2>
      }
      body={
        <p>
          <FormattedMessage
            id="xpack.csp.noVulnerabilitiesStates.noAgentsDeployed.noAgentsDeployedDescription"
            defaultMessage="In order to begin detecting vulnerabilities, you'll need to deploy elastic-agent into the cloud account or Kubernetes cluster you want to monitor."
          />
        </p>
      }
      actions={[
        <EuiButton fill href={integrationPoliciesLink} isDisabled={!integrationPoliciesLink}>
          <FormattedMessage
            id="xpack.csp.noVulnerabilitiesStates.noAgentsDeployed.noAgentsDeployedButtonTitle"
            defaultMessage="Install Agent"
          />
        </EuiButton>,
      ]}
    />
  );
};

/**
 * This component will return the render states based on cloud posture setup status API
 * since 'not-installed' is being checked globally by CloudPosturePage and 'indexed' is the pass condition, those states won't be handled here
 * */
export const NoVulnerabilitiesStates = () => {
  const getSetupStatus = useCspSetupStatusApi({
    refetchInterval: REFETCH_INTERVAL_MS,
  });
  const vulnMgmtIntegrationLink = useCspIntegrationLink(VULN_MGMT_POLICY_TEMPLATE);

  const status = getSetupStatus.data?.vuln_mgmt?.status;
  const indicesStatus = getSetupStatus.data?.indicesDetails;
  const unprivilegedIndices =
    indicesStatus &&
    indicesStatus
      .filter((idxDetails) => idxDetails.status === 'unprivileged')
      .map((idxDetails: IndexDetails) => idxDetails.index)
      .sort((a, b) => a.localeCompare(b));

  const render = () => {
    if (status === 'indexing' || status === 'waiting_for_results' || status === 'index-timeout')
      return <ScanningVulnerabilitiesEmptyPrompt />; // integration installed, but no agents added// agent added, index timeout has passed
    if (status === 'not-installed')
      return (
        <CnvmIntegrationNotInstalledEmptyPrompt vulnMgmtIntegrationLink={vulnMgmtIntegrationLink} />
      );
    if (status === 'not-deployed') return <AgentNotDeployedEmptyPrompt />;
    if (status === 'unprivileged')
      return <Unprivileged unprivilegedIndices={unprivilegedIndices || []} />; // user has no privileges for our indices
  };

  return (
    <CloudPosturePage query={getSetupStatus}>
      <FullSizeCenteredPage>{render()}</FullSizeCenteredPage>
    </CloudPosturePage>
  );
};
