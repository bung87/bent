'use strict'

const core = require('./core')
const btoa = require('btoa-lite')
const Headers = require('fetch-headers') // fetch since 2016, edge 14, IE 11 not support
const URL = require('url-parse') // since 2015 edge 12, IE 11 not support
// ArrayBuffer since 2016 edge 14, IE 11 not support
class StatusError extends Error {
  constructor (res, ...params) {
    super(...params)

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StatusError)
    }

    this.name = 'StatusError'
    this.message = res.statusMessage
    this.statusCode = res.status
    this.res = res
    this.json = res.json.bind(res)
    this.text = res.text.bind(res)
    this.blob = res.blob.bind(res)
    this.arrayBuffer = res.arrayBuffer.bind(res)
    let buffer
    const get = () => {
      if (!buffer) buffer = this.arrayBuffer()
      return buffer
    }
    Object.defineProperty(this, 'responseBody', { get })
    // match Node.js headers object
    this.headers = {}
    for (const [key, value] of res.headers.entries()) {
      this.headers[key.toLowerCase()] = value
    }
  }
}

const mkrequest = (statusCodes, method, encoding, headers, baseurl, fetch) => async (_url, body, _headers = {}) => {
  _url = baseurl + (_url || '')
  let parsed = new URL(_url)

  if (!headers) headers = {}
  if (parsed.username) {
    headers.Authorization = 'Basic ' + btoa(parsed.username + ':' + parsed.password)
    parsed = new URL(parsed.protocol + '//' + parsed.host + parsed.pathname + parsed.search)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Unknown protocol, ${parsed.protocol}`)
  }

  if (body) {
    if (body instanceof ArrayBuffer ||
      ArrayBuffer.isView(body) ||
      typeof body === 'string'
    ) {
      // noop
    } else if (typeof body === 'object') {
      body = JSON.stringify(body)
      headers['Content-Type'] = 'application/json'
    } else {
      throw new Error('Unknown body type.')
    }
  }

  _headers = new Headers({ ...(headers || {}), ..._headers })

  const resp = await fetch(parsed, { method, headers: _headers, body })
  resp.statusCode = resp.status

  if (!statusCodes.has(resp.status)) {
    throw new StatusError(resp)
  }

  if (encoding === 'json') return resp.json()
  else if (encoding === 'buffer') return resp.arrayBuffer()
  else if (encoding === 'string') return resp.text()
  else if (encoding === 'blob') return resp.blob()
  else return resp
}

module.exports = core(mkrequest)
