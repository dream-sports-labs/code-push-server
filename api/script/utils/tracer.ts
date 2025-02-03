import ddTrace from 'dd-trace'
ddTrace.init(
  {
    profiling: true,
    version: '8.1.6',
    env: 'load',
  }
) // initialized in a different file to avoid hoisting.
export default ddTrace

export const getTraceId = () => {
  const span = ddTrace.scope().active()
  return span ? span.context().toTraceId() : undefined
}

export const getSpanId = () => {
  const span = ddTrace.scope().active()
  return span ? span.context().toSpanId() : undefined
}

export const addDataDogTagsToSpan = (kv: {[key: string]: any}) => {
  const span = ddTrace.scope().active()
  if (span) {
    span.addTags(kv)
  }
}

export const sendErrorToDatadog = (err: Error) => {
    try {
      addDataDogTagsToSpan({
        'error.msg': err.message,
        'error.type': err.name,
        'error.stack': err.stack
      });
    } catch (loggingError) {
      console.log('Failed to send error to Datadog:', loggingError);
    }
  };
  