import { nextTick, reactive, toRefs, watchEffect } from 'vue';
import { Config } from './config';
// P mean params, R mean Response
export type Request<P extends any[], R> = (...args: P) => Promise<R>;
type MutateData<R> = (newData: R) => void;
type MutateFunction<R> = (arg: (oldData: R) => R) => void;
export interface Mutate<R> extends MutateData<R>, MutateFunction<R> {}

export type QueryState<P extends any[], R> = {
  loading: boolean;
  data: R | undefined;
  error: Error | undefined;
  params: P;
  run: (...arg: P) => Promise<R>;
  cancel: () => void;
  refresh: () => Promise<R>;
  mutate: Mutate<R>;
};

const setStateBind = <T>(oldState: T) => {
  return (newState: T, cb?: () => void) => {
    Object.keys(newState).forEach(key => {
      oldState[key] = newState[key];
    });
    nextTick(() => {
      cb?.();
    });
  };
};

const createQuery = <P extends any[], R>(
  request: Request<P, R>,
  config: Config<P, R>,
): QueryState<P, R> => {
  const { throwOnError, initialData, ready, onSuccess, onError } = config;

  watchEffect(() => {
    console.log('createQuery ready', (ready as any).value);
  });

  const state = reactive({
    loading: false,
    data: initialData,
    error: undefined,
    params: ([] as unknown) as P,
  }) as Partial<QueryState<P, R>>;

  const setState = setStateBind(state);

  const _run = (...args: P) => {
    state.loading = true;
    setState({
      loading: true,
      params: args,
    });
    return request(...args)
      .then(res => {
        setState({
          data: res,
          loading: false,
          error: undefined,
        });

        if (onSuccess) {
          onSuccess(res, args);
        }

        return res;
      })
      .catch(error => {
        setState({
          data: undefined,
          loading: false,
          error: error,
        });
        if (onError) {
          onError(error, args);
        }

        if (throwOnError) {
          throw error;
        }
        console.error(error);
        return Promise.reject('已处理的错误');
      })
      .finally(() => {
        console.log('1');
      });
  };

  const run = (...args: P) => {
    if (!ready) {
      return;
    }
    return _run(...args);
  };

  const cancel = () => {
    return;
  };

  const refresh = () => {
    return run(...state.params!);
  };

  const mutate: Mutate<R> = (
    x: Parameters<MutateData<R>>[0] | Parameters<MutateFunction<R>>[0],
  ) => {
    if (x instanceof Function) {
      state.data = x(state.data!);
    } else {
      state.data = x;
    }
  };

  const reactiveState = reactive({
    ...toRefs(state),
    run,
    cancel,
    refresh,
    mutate,
  }) as QueryState<P, R>;

  return reactiveState;
};

export default createQuery;
