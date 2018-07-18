'use strict';

const nock = require('nock');
const zlib = require('zlib');
const preq = require('../index');
const assert = require('assert');

require('mocha-eslint')([ '.' ]);

describe('preq', function() {
    this.timeout(30000); // eslint-disable no-invalid-this

    it('should retry', () => {
        const api = nock('https://en.wikipedia.org')
        .get('/wiki/Main_Page')
        .times(4)
        .replyWithError('Error');
        const tStart = new Date();
        return preq.get({
            // Some unreachable port
            uri: 'https://en.wikipedia.org/wiki/Main_Page',
            retries: 4
        })
        .catch((e) => {
            assert.equal(e.status, 504);
            const tDelta = new Date() - tStart;
            if (tDelta < 1500) {
                throw new Error("Does not look as if this actually retried!");
            }
        })
        .then(() => api.done())
        .finally(() => nock.cleanAll());
    });

    it('should get enwiki front page', () => {
        const MOCK_BODY = 'Main_Wiki_Page_HTML';
        const api = nock('https://en.wikipedia.org')
        .get('/wiki/Main_Page')
        .reply(200, MOCK_BODY);
        return preq.get({
            uri: 'https://en.wikipedia.org/wiki/Main_Page',
        })
        .then((res) => {
            assert.equal(res.status, 200);
            assert.equal(!!res.body, true);
            // Make sure content-location is not set
            assert.equal(!!res.headers['content-location'], false);
            assert.equal(res.body, MOCK_BODY);
        })
        .then(() => api.done())
        .finally(() => nock.cleanAll());
    });

    it('should check for redirect', () => {
        const MOCK_BODY = 'Main_Wiki_Page_HTML';
        const api = nock('https://en.wikipedia.org')
        .get('/')
        .reply(301, undefined, { location: 'https://en.wikipedia.org/wiki/Main_Page' })
        .get('/wiki/Main_Page')
        .reply(200, MOCK_BODY);
        return preq.get({
            uri: 'https://en.wikipedia.org/'
        })
        .then((res) => {
            assert.equal(res.status, 200);
            assert.equal(res.headers['content-location'],
                'https://en.wikipedia.org/wiki/Main_Page');
            assert.equal(res.body, MOCK_BODY);
        })
        .then(() => api.done())
        .finally(() => nock.cleanAll());
    });

    it('should support query', () => {
        const MOCK_BODY = 'Main_Wiki_Page_HTML';
        const api = nock('https://en.wikipedia.org')
        .get('/wiki/Main_Page')
        .query({ q : 'foo' })
        .reply(200, MOCK_BODY);
        return preq.get({
            uri: 'https://en.wikipedia.org/wiki/Main_Page',
            query: {
                q: 'foo'
            }
        })
        .then((res) => {
            assert.equal(res.status, 200);
            assert.equal(res.body, MOCK_BODY);
        })
        .then(() => api.done())
        .finally(() => nock.cleanAll());
    });

    it('should support simple constructor style', () => {
        const MOCK_BODY = 'Main_Wiki_Page_HTML';
        const api = nock('https://en.wikipedia.org')
        .get('/wiki/Main_Page')
        .reply(200, MOCK_BODY);
        return preq('https://en.wikipedia.org/wiki/Main_Page')
        .then((res) => {
            assert.equal(res.status, 200);
            assert.equal(res.body, MOCK_BODY);
        })
        .then(() => api.done())
        .finally(() => nock.cleanAll());
    });

    it('should support simple constructor style with query', () => {
        const MOCK_BODY = 'Main_Wiki_Page_HTML';
        const api = nock('https://en.wikipedia.org')
        .get('/wiki/Main_Page')
        .query({ q : 'foo' })
        .reply(200, MOCK_BODY);
        return preq({
            method: 'get',
            uri: 'https://en.wikipedia.org/wiki/Main_Page',
            query: {
                q: 'foo'
            }
        })
        .then((res) => {
            assert.equal(res.status, 200);
            assert.equal(res.body, MOCK_BODY);
        })
        .then(() => api.done())
        .finally(() => nock.cleanAll());
    });

    it('return buffer on user-supplied encoding', () => {
        const MOCK_BODY = 'Main_Wiki_Page_HTML';
        const api = nock('https://en.wikipedia.org')
        .get('/wiki/Main_Page')
        .reply(200, MOCK_BODY);
        return preq('https://en.wikipedia.org/wiki/Main_Page', { encoding: null })
        .then((res) => {
            assert.equal(res.status, 200);
            assert.equal(res.body.constructor.name, 'Buffer');
        })
        .then(() => api.done())
        .finally(() => nock.cleanAll());
    });

    it('no content-encoding header for gzipped responses', () => {
        const MOCK_BODY = 'Main_Wiki_Page_HTML';
        const api = nock('https://en.wikipedia.org')
        .get('/wiki/Main_Page')
        .reply(200, zlib.gzipSync(Buffer.from(MOCK_BODY)), { 'content-encoding': 'gzip' });
        return preq({
            uri: 'https://en.wikipedia.org/wiki/Main_Page',
            gzip: true
        })
        .then((res) => {
            assert.equal(res.status, 200);
            assert.equal(res.headers['content-encoding'], undefined);
            assert.equal(res.body, MOCK_BODY);
        })
        .then(() => api.done())
        .finally(() => nock.cleanAll());
    });

    it('request some real content, no nock', () => preq('https://en.wikipedia.org/wiki/Main_Page')
    .then((res) => {
        assert.equal(res.status, 200);
        assert.equal(!!res.body, true);
    }));

    it('timeout with connect timeout', () => preq({
        uri: 'http://localhost:12345',
        connectTimeout: 1
    })
    .catch(e => assert.equal(e.status, 504)));
});

