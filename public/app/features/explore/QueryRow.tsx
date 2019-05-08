// Libraries
import React, { PureComponent } from 'react';
import _ from 'lodash';
import { hot } from 'react-hot-loader';
// @ts-ignore
import { connect } from 'react-redux';

// Components
import QueryEditor from './QueryEditor';

// Actions
import { changeQuery, modifyQueries, runQueries, addQueryRow } from './state/actions';

// Types
import { StoreState } from 'app/types';
import {
  TimeRange,
  DataQuery,
  ExploreDataSourceApi,
  QueryFixAction,
  DataSourceStatus,
  PanelData,
  LoadingState,
  QueryType,
} from '@grafana/ui';
import { HistoryItem, ExploreItemState, ExploreId } from 'app/types/explore';
import { Emitter } from 'app/core/utils/emitter';
import { highlightLogsExpressionAction, removeQueryRowAction } from './state/actionTypes';
import QueryStatus from './QueryStatus';

interface QueryRowProps {
  addQueryRow: typeof addQueryRow;
  changeQuery: typeof changeQuery;
  className?: string;
  exploreId: ExploreId;
  queryType: QueryType;
  datasourceInstance: ExploreDataSourceApi;
  datasourceStatus: DataSourceStatus;
  highlightLogsExpressionAction: typeof highlightLogsExpressionAction;
  history: HistoryItem[];
  index: number;
  query: DataQuery;
  modifyQueries: typeof modifyQueries;
  exploreEvents: Emitter;
  range: TimeRange;
  removeQueryRowAction: typeof removeQueryRowAction;
  runQueries: typeof runQueries;
  queryResponse: PanelData;
  latency: number;
}

export class QueryRow extends PureComponent<QueryRowProps> {
  onRunQuery = () => {
    const { exploreId } = this.props;
    this.props.runQueries(exploreId);
  };

  onChange = (query: DataQuery, override?: boolean) => {
    const { datasourceInstance, exploreId, index } = this.props;
    this.props.changeQuery(exploreId, query, index, override);
    if (query && !override && datasourceInstance.getHighlighterExpression && index === 0) {
      // Live preview of log search matches. Only use on first row for now
      this.updateLogsHighlights(query);
    }
  };

  componentWillUnmount() {
    console.log('QueryRow will unmount');
  }

  onClickAddButton = () => {
    const { exploreId, index } = this.props;
    this.props.addQueryRow(exploreId, index);
  };

  onClickClearButton = () => {
    this.onChange(null, true);
  };

  onClickHintFix = (action: QueryFixAction) => {
    const { datasourceInstance, exploreId, index } = this.props;
    if (datasourceInstance && datasourceInstance.modifyQuery) {
      const modifier = (queries: DataQuery, action: QueryFixAction) => datasourceInstance.modifyQuery(queries, action);
      this.props.modifyQueries(exploreId, action, index, modifier);
    }
  };

  onClickRemoveButton = () => {
    const { exploreId, index } = this.props;
    this.props.removeQueryRowAction({ exploreId, index });
    this.props.runQueries(exploreId);
  };

  updateLogsHighlights = _.debounce((value: DataQuery) => {
    const { datasourceInstance } = this.props;
    if (datasourceInstance.getHighlighterExpression) {
      const { exploreId } = this.props;
      const expressions = [datasourceInstance.getHighlighterExpression(value)];
      this.props.highlightLogsExpressionAction({ exploreId, expressions });
    }
  }, 500);

  render() {
    const {
      queryType,
      datasourceInstance,
      history,
      query,
      exploreEvents,
      range,
      datasourceStatus,
      queryResponse,
      latency,
    } = this.props;
    const QueryField = datasourceInstance.components.ExploreQueryField;

    return (
      <div className="query-row">
        <div className="query-row-status">
          <QueryStatus queryResponse={queryResponse} latency={latency} />
        </div>
        <div className="query-row-field flex-shrink-1">
          {QueryField ? (
            <QueryField
              queryType={queryType}
              datasource={datasourceInstance}
              datasourceStatus={datasourceStatus}
              query={query}
              history={history}
              onRunQuery={this.onRunQuery}
              onHint={this.onClickHintFix}
              onChange={this.onChange}
              panelData={null}
              queryResponse={queryResponse}
            />
          ) : (
            <QueryEditor
              queryType={queryType}
              datasource={datasourceInstance}
              error={queryResponse.error && queryResponse.error.message ? queryResponse.error.message : null}
              onQueryChange={this.onChange}
              onExecuteQuery={this.onRunQuery}
              initialQuery={query}
              exploreEvents={exploreEvents}
              range={range}
            />
          )}
        </div>
        <div className="gf-form-inline flex-shrink-0">
          <div className="gf-form">
            <button className="gf-form-label gf-form-label--btn" onClick={this.onClickClearButton}>
              <i className="fa fa-times" />
            </button>
          </div>
          <div className="gf-form">
            <button className="gf-form-label gf-form-label--btn" onClick={this.onClickAddButton}>
              <i className="fa fa-plus" />
            </button>
          </div>
          <div className="gf-form">
            <button className="gf-form-label gf-form-label--btn" onClick={this.onClickRemoveButton}>
              <i className="fa fa-minus" />
            </button>
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state: StoreState, { exploreId, index }: QueryRowProps) {
  const explore = state.explore;
  const item: ExploreItemState = explore[exploreId];
  const {
    datasourceInstance,
    history,
    queries,
    range,
    datasourceError,
    graphResult,
    graphIsLoading,
    tableIsLoading,
    logIsLoading,
    latency,
    queryType,
  } = item;
  const query = queries[index];
  const datasourceStatus = datasourceError ? DataSourceStatus.Disconnected : DataSourceStatus.Connected;
  const error =
    item.queryError && item.queryError.refId && item.queryError.refId === query.refId ? item.queryError : null;
  const series = graphResult ? graphResult : []; // TODO: use SeriesData
  const queryResponseState =
    graphIsLoading || tableIsLoading || logIsLoading
      ? LoadingState.Loading
      : error
      ? LoadingState.Error
      : LoadingState.Done;
  const queryResponse: PanelData = {
    series,
    state: queryResponseState,
    error,
  };

  return {
    queryType,
    datasourceInstance,
    history,
    query,
    range,
    datasourceStatus,
    queryResponse,
    latency,
  };
}

const mapDispatchToProps = {
  addQueryRow,
  changeQuery,
  highlightLogsExpressionAction,
  modifyQueries,
  removeQueryRowAction,
  runQueries,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(QueryRow)
);
