/**
 * @typedef {Object} SwapEvent
 * @property {string} userId
 * @property {string} type
 * @property {string} title
 * @property {string} body
 * @property {Object<string, any>} [payload]
 * @property {Date} createdAt
 */

/**
 * @interface IObserver
 * @property {(event: SwapEvent) => Promise<void>|void} update
 * @property {() => string} getChannel
 */

/**
 * @interface ISubject
 * @property {(o: IObserver) => void} addObserver
 * @property {(o: IObserver) => void} removeObserver
 * @property {(e: SwapEvent) => Promise<void>} notifyAll
 */

module.exports = {};

