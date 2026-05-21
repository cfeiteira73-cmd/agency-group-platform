declare module 'ioredis' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export default class Redis {
    constructor(url?: string, options?: Record<string, unknown>)
    status: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string, handler: (...args: any[]) => void): this
    quit(): Promise<string>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connect(): Promise<void>
    disconnect(): Promise<void>
    ping(): Promise<string>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    xadd(key: string, id: string, ...args: any[]): Promise<string | null>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    xreadgroup(command: string, group: string, consumer: string, ...args: any[]): Promise<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    xack(key: string, group: string, id: string): Promise<number>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    xgroup(command: string, key: string, group: string, id: string, ...args: any[]): Promise<any>
    xlen(key: string): Promise<number>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    xrange(key: string, start: string, end: string, ...args: any[]): Promise<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    xpending(key: string, group: string, ...args: any[]): Promise<any>
    xdel(key: string, ...ids: string[]): Promise<number>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keys(pattern: string): Promise<string[]>
  }
}

declare module 'kafkajs' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const CompressionTypes: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const CompressionCodecs: any
  export interface KafkaConfig { brokers: string[]; clientId?: string; [key: string]: unknown }
  export interface TopicMessages { topic: string; messages: Array<{ key?: string; value: string; headers?: Record<string, string> }> }
  export class Kafka {
    constructor(config: KafkaConfig)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    producer(options?: Record<string, any>): Producer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    consumer(options?: Record<string, any>): Consumer
    admin(): Admin
  }
  export interface Producer {
    connect(): Promise<void>
    disconnect(): Promise<void>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    send(params: Record<string, any>): Promise<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendBatch(params: Record<string, any>): Promise<any>
    on(event: string, handler: (...args: unknown[]) => void): this
  }
  export interface Consumer {
    connect(): Promise<void>
    disconnect(): Promise<void>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subscribe(params: Record<string, any>): Promise<void>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    run(params: Record<string, any>): Promise<void>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    commitOffsets(offsets: any[]): Promise<void>
    seek(params: { topic: string; partition: number; offset: string }): Promise<void>
    on(event: string, handler: (...args: unknown[]) => void): this
  }
  export interface Admin {
    connect(): Promise<void>
    disconnect(): Promise<void>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listTopics(): Promise<string[]>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetchTopicOffsets(topic: string): Promise<Array<{ partition: number; offset: string; high: string; low: string; [key: string]: any }>>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetchOffsets(params: Record<string, any>): Promise<Array<{ topic: string; partitions: Array<{ partition: number; offset: string; [key: string]: any }> }>>
    describeGroups(groupIds: string[]): Promise<{ groups: Array<{ groupId: string; members: unknown[] }> }>
    on(event: string, handler: (...args: unknown[]) => void): this
  }
  export const Partitioners: { LegacyPartitioner: unknown }
  export const logLevel: { ERROR: number; WARN: number; INFO: number; DEBUG: number }
}

declare module '@temporalio/client' {
  export interface ConnectionOptions { address?: string; [key: string]: unknown }
  export interface WorkflowStartOptions { taskQueue: string; workflowId?: string; args?: unknown[]; [key: string]: unknown }
  export class Connection {
    static connect(options?: ConnectionOptions): Promise<Connection>
    close(): Promise<void>
  }
  export class Client {
    constructor(options?: { connection?: Connection; namespace?: string })
    workflow: {
      start(fn: unknown, options: WorkflowStartOptions): Promise<WorkflowHandle>
      execute(fn: unknown, options: WorkflowStartOptions): Promise<unknown>
      getHandle(workflowId: string): WorkflowHandle
    }
  }
  export interface WorkflowHandle {
    workflowId: string
    result(): Promise<unknown>
    signal(name: string, ...args: unknown[]): Promise<void>
    query(name: string, ...args: unknown[]): Promise<unknown>
    cancel(): Promise<void>
    describe(): Promise<{ status: { code: string }; startTime: Date }>
  }
}

declare module '@opentelemetry/sdk-node' {
  export class NodeSDK {
    constructor(options?: Record<string, unknown>)
    start(): void
    shutdown(): Promise<void>
  }
}

declare module '@opentelemetry/exporter-trace-otlp-http' {
  export class OTLPTraceExporter {
    constructor(options?: { url?: string; headers?: Record<string, string> })
  }
}

declare module 'uuid' {
  export function v4(): string
  export function v1(): string
  export function v3(name: string | Uint8Array, namespace: string | Uint8Array): string
  export function v5(name: string | Uint8Array, namespace: string | Uint8Array): string
  export function validate(uuid: string): boolean
  export function version(uuid: string): number
  export function parse(uuid: string): Uint8Array
  export function stringify(arr: Uint8Array): string
  export const NIL: string
}

// twilio — optional peer dep (graceful no-op when not installed)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare module 'twilio' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Twilio: any
  export default Twilio
  export = Twilio
}
