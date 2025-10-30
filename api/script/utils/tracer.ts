import { context, trace, SpanStatusCode, Attributes } from '@opentelemetry/api';

export const getTraceId = (): string | undefined => {
  const span = trace.getSpan(context.active());
  return span ? span.spanContext().traceId : undefined;
};

export const getSpanId = (): string | undefined => {
  const span = trace.getSpan(context.active());
  return span ? span.spanContext().spanId : undefined;
};

export const addOtelAttributesToSpan = (kv: { [key: string]: any }): void => {
  const span = trace.getSpan(context.active());
  if (!span) return;

  const attrs: Attributes = {};
  for (const [k, v] of Object.entries(kv)) {
    if (v == null) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      attrs[k] = v;
    } else {
      attrs[k] = JSON.stringify(v);
    }
  }
  span.setAttributes(attrs);
};

export const sendErrorToSignoz = (err: Error): void => {
  try{
    const span = trace.getSpan(context.active());
    if (!span) return;
  
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    span.setAttributes({
      'error.msg': err.message,
      'error.type': err.name,
      'error.stack': err.stack || '',
    });
  } catch (loggingError) {
    console.log('Error sending error to Signoz:', loggingError);
  }
};