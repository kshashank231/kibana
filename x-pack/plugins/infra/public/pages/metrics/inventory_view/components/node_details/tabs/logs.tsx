/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useMemo, useState } from 'react';
import useDebounce from 'react-use/lib/useDebounce';
import { FormattedMessage } from '@kbn/i18n-react';
import { i18n } from '@kbn/i18n';
import { EuiFieldSearch } from '@elastic/eui';
import { EuiFlexGroup } from '@elastic/eui';
import { EuiFlexItem } from '@elastic/eui';
import { EuiButtonEmpty } from '@elastic/eui';
import { useLinkProps } from '@kbn/observability-shared-plugin/public';
import { TabContent, TabProps } from './shared';
import { LogStream } from '../../../../../../components/log_stream';
import { useWaffleOptionsContext } from '../../../hooks/use_waffle_options';
import { findInventoryFields } from '../../../../../../../common/inventory_models';
import { getNodeLogsUrl } from '../../../../../link_to';

const TabComponent = (props: TabProps) => {
  const [textQuery, setTextQuery] = useState('');
  const [textQueryDebounced, setTextQueryDebounced] = useState('');
  const endTimestamp = props.currentTime;
  const startTimestamp = endTimestamp - 60 * 60 * 1000; // 60 minutes
  const { nodeType } = useWaffleOptionsContext();
  const { node } = props;

  useDebounce(() => setTextQueryDebounced(textQuery), textQueryThrottleInterval, [textQuery]);

  const filter = useMemo(() => {
    const query = [
      `${findInventoryFields(nodeType).id}: "${node.id}"`,
      ...(textQueryDebounced !== '' ? [textQueryDebounced] : []),
    ].join(' and ');

    return {
      language: 'kuery',
      query,
    };
  }, [nodeType, node.id, textQueryDebounced]);

  const onQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTextQuery(e.target.value);
  }, []);

  const nodeLogsMenuItemLinkProps = useLinkProps(
    getNodeLogsUrl({
      nodeType,
      nodeId: node.id,
      time: startTimestamp,
    })
  );

  return (
    <TabContent>
      <EuiFlexGroup gutterSize={'m'} alignItems={'center'} responsive={false}>
        <EuiFlexItem>
          <EuiFieldSearch
            data-test-subj="infraTabComponentFieldSearch"
            fullWidth
            placeholder={i18n.translate('xpack.infra.nodeDetails.logs.textFieldPlaceholder', {
              defaultMessage: 'Search for log entries...',
            })}
            value={textQuery}
            isClearable
            onChange={onQueryChange}
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty
            data-test-subj="infraTabComponentOpenInLogsButton"
            size={'xs'}
            flush={'both'}
            iconType={'popout'}
            {...nodeLogsMenuItemLinkProps}
          >
            <FormattedMessage
              id="xpack.infra.nodeDetails.logs.openLogsLink"
              defaultMessage="Open in Logs"
            />
          </EuiButtonEmpty>
        </EuiFlexItem>
      </EuiFlexGroup>
      <LogStream
        logView={{ type: 'log-view-reference', logViewId: 'default' }}
        startTimestamp={startTimestamp}
        endTimestamp={endTimestamp}
        query={filter}
      />
    </TabContent>
  );
};

export const LogsTab = {
  id: 'logs',
  name: i18n.translate('xpack.infra.nodeDetails.tabs.logs', {
    defaultMessage: 'Logs',
  }),
  content: TabComponent,
};

const textQueryThrottleInterval = 1000; // milliseconds
