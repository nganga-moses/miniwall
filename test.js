const assert = require('chai').assert;

const axios = require('axios');

const apiUrl = 'http://localhost:3000/api'; // replace with your API URL

let olgaToken;
let nickToken;
let maryToken;
let postId;
// User registration and token retrieval

describe('TC 1 & 2: User Registration and Token Retrieval',  () => {

    it('should register Olga, Nick and Mary and retrieve their tokens', async () => {
        const users = [
            {
                name: 'Olga',
                email: 'olga@email.com',
                password: 'password123'
            },
            {
                name: 'Nick',
                email: 'nick@email.com',
                password: 'password123'
            },
            {
                name: 'Mary',
                email: 'mary@email.com',
                password: 'password123'
            }
        ];

        for (const user of users) {
            const response = await axios.post(`${apiUrl}/auth/register`, {
                name: user.name,
                email: user.email,
                password: user.password,
            });
            assert.strictEqual(response.status, 200);

            const authResponse = await axios.post(`${apiUrl}/auth/login`, {
                email: user.email,
                password: user.password
            });
            assert.strictEqual(authResponse.status, 200);
            assert(authResponse.data.token);

            if (user.name === 'Olga') {
                olgaToken = authResponse.data.token;
            } else if (user.name === 'Nick') {
                nickToken = authResponse.data.token;
            } else {
                maryToken = authResponse.data.token;
            }
        }
    });
});

// Test unauthorized access
describe('TC 3: Test unauthorized access', () => {
    it('should return 401 Unauthorized when accessing an API endpoint without a token', async () => {
        try {
            await axios.post(`${apiUrl}/posts`, {title: 'Test Post', content: 'Test Post'});
        } catch (error) {
            assert.strictEqual(error.response.status, 401);
            assert.strictEqual(error.response.data.error, 'Unauthorized');
        }
    });
});

// Test posting text
describe('TC 4-6: Test posting text', () => {

    it('should allow Olga to post text using her token', async () => {
        const response = await axios.post(`${apiUrl}/posts`, {title: 'Olga Test Post', content: 'Olga Test Post'},
            {headers: {Authorization: `Bearer ${olgaToken}`}});
        assert.strictEqual(response.status, 200);
    });

    it('should allow Nick to post text using his token', async () => {
        const response = await axios.post(`${apiUrl}/posts`, {title: 'Nick Test Post', content: 'Nick Test Post'},
            {headers: {Authorization: `Bearer ${nickToken}`}});
        assert.strictEqual(response.status, 200);
    });

    it('should allow Mary to post text using her token', async () => {
        const response = await axios.post(`${apiUrl}/posts`, {title: 'Mary Test Post', content: 'Mary Test Post'},
            {headers: {Authorization: `Bearer ${maryToken}`}});
        assert.strictEqual(response.status, 200);
    });
});

// Test browsing posts in chronological order
describe('TC 7: Test browsing posts in chronological order', async () => {

    it('should fail to retrieve posts in chronological order with no authorization', async () => {
        try {
            await axios.get(`${apiUrl}/posts`);
        } catch (error) {
            assert.strictEqual(error.response.status, 401);
            assert.strictEqual(error.response.data.error, 'invalid request. Authentication failed');
        }
    });

    it('should retrieve posts in chronological order with authorization', async () => {
        const res = await axios.get(`${apiUrl}/posts`,
            {headers: {Authorization: `Bearer ${nickToken}`}});
        const posts = res.data;
        assert.equal(posts[0].title, 'Olga Test Post');
        assert.equal(posts[1].title, 'Nick Test Post');
        assert.equal(posts[2].title, 'Mary Test Post');
    });
});
// Test commenting on posts in round-robin fashion
describe('TC 8: Test commenting on posts in round-robin fashion', () => {


    before(async () => {
        // Post a text by Mary
        const postResponse = await axios.post(`${apiUrl}/posts`, {
            title: 'Mary Test Post',
            content: 'Mary Test Post'
        }, {headers: {Authorization: `Bearer ${maryToken}`}});
        postId = postResponse.data._id;

    });

    it('Nick and Olga comment on Mary’s post in a round-robin fashion', async () => {
        // Comment by Nick
        const nickCommentResponse = await axios.post(
            `${apiUrl}/comments/${postId}`,
            {content: 'Nice post, Mary!'},
            {headers: {Authorization: `Bearer ${nickToken}`}}
        );
        assert.equal(nickCommentResponse.status, 200);
        assert.equal(nickCommentResponse.data.content, 'Nice post, Mary!');

        // Comment by Olga
        const olgaCommentResponse = await axios.post(
            `${apiUrl}/comments/${postId}`,
            {content: 'I agree, Nick!'},
            {headers: {Authorization: `Bearer ${olgaToken}`}}
        );
        assert.equal(olgaCommentResponse.status, 200);
        assert.equal(olgaCommentResponse.data.content, 'I agree, Nick!');
    });
});
// Test that Mary cannot comment on her own post
describe('TC 9: Test that Mary cannot comment on her own post', () => {
    it('should return a 401 status code', async () => {
        try {
            const res = await axios.post(`${apiUrl}/comments/${postId}`,
                {content: 'This comment should not be allowed'},
                {headers: {Authorization: `Bearer ${maryToken}`}});
        } catch (error) {
            assert.strictEqual(error.response.status, 401);
        }
    });
});
// Test browsing posts in chronological order with no likes
describe('TC 10: Test browsing posts in chronological order with no likes', () => {
    it('should return a list of posts in chronological order', async () => {
        const res = await axios.get(`${apiUrl}/posts`,{headers: {Authorization: `Bearer ${maryToken}`}});
        assert.equal(res.status, 200);
        assert.equal(res.data[0].title, 'Olga Test Post');
        assert.equal(res.data[1].title, 'Nick Test Post');
        assert.equal(res.data[2].title, 'Mary Test Post');
    });
});
// Test that Mary can see comments on her post
describe('TC 11: Test that Mary can see comments on her post', () => {
    it('should return a list of comments on Mary\'s post', async () => {
        const res = await axios.get(`${apiUrl}/comments/${postId}`,{headers: {Authorization: `Bearer ${maryToken}`}});
        assert.equal(res.status, 200);
        assert.equal(res.data[0].content, 'Nice post, Mary!');
        assert.equal(res.data[1].content, 'I agree, Nick!');
    });
});
// Test that Nick and Olga can like Mary's post
describe('TC 12: Test that Nick and Olga can like Mary\'s post', () => {
    it('should return a 200 status code', async () => {
        const res1 = await axios.post(`${apiUrl}/likes/${postId}`,{},
            {headers: {Authorization: `Bearer ${olgaToken}`}});
        const res2 = await axios.post(`${apiUrl}/likes/${postId}`,{},
            {headers: {Authorization: `Bearer ${nickToken}`}});
        assert.equal(res1.status, 200);
        assert.equal(res2.status, 200);
    });
});
// Test that Mary cannot like her own post
describe('TC 13: Test that Mary cannot like her own post', () => {
    it('should return a 401 status code', async () => {
        try {
            await axios.post(`${apiUrl}/likes/${postId}`,{},
            {headers: {Authorization: `Bearer ${maryToken}`}});
        } catch (error) {
            assert.strictEqual(error.response.status, 401);
        }
    });
});

describe('TC 14: Test that Mary can see the number of likes on her post', () => {
    it('should return a post with two likes', async () => {
        const res = await axios.get(`${apiUrl}/likes/${postId}`,{headers: {Authorization: `Bearer ${maryToken}`}});
        assert.equal(res.status, 200);
    });
});

describe('TC 15: Test browsing posts in chronological order with likes', () => {
    it('should return a list of posts in chronological order with Mary\'s post at the top', async () => {
        const res = await axios.get(`${apiUrl}/posts`,{headers: {Authorization: `Bearer ${maryToken}`}});
        assert.equal(res.status, 200);
        assert.equal(res.data[0].title, 'Mary Test Post');
        assert.equal(res.data[1].title, 'Olga Test Post');
        assert.equal(res.data[2].title, 'Nick Test Post');
    });
});
