require ('dotenv').config()

const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const bcrypt  = require('bcryptjs')
const jwt = require('jsonwebtoken')

//Data Models
const Post = require('./model/Post')
const User = require('./model/User')
const Comment = require('./model/Comment')

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({extended:true}))
mongoose.connect(process.env.DB_URL).then(()=>{
    console.log('Connected to MongoDB')
}).catch((error)=>{
    console.log('Error Connecting to MongoDB:',error.message)
})

// Authentication routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = await bcrypt.hash(req.body.password, salt)
        const user = new User({
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword
        })

        const savedUser = await user.save()

        res.json(savedUser)

    } catch (error) {
        res.status(400).json({ error: error.message })
    }
})
app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email })
    const passwordCorrect = user === null
        ? false
        : await bcrypt.compare(req.body.password, user.password)

    if (!(user && passwordCorrect)) {
        return res.status(401).json({ error: 'invalid username or password' })
    }

    const userForToken = {
        username: user.email,
        id: user._id
    }

    const token = jwt.sign(userForToken, process.env.JWT_SECRET)

    res.status(200).json({ token, username: user.username })
})
function authenticate(req) {
    if(!req.headers.authorization){
        return [false,'']

    }
    const token = req.headers.authorization.split(' ')[1]
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    return [!(!token || !decodedToken.id),decodedToken];

}
// Post routes
app.get('/api/posts', async (req, res) => {

    if (!authenticate(req)[0]){
        return res.status(401).json({ error: 'invalid request. Authentication failed' })
    }

    const posts = await Post.find({}).sort({ likes: -1, created_at: 1 })
        .populate('author', { username: 1 })
        .populate('comments', { author: 1, content: 1 })
        .populate('likes', { username: 1 })

    res.json(posts)
})

app.post('/api/posts', async (req, res) => {
    let decodedToken = authenticate(req);

    if (!decodedToken[0]){
        return res.status(401).json({ error: 'Unauthorized' })
    }

    const user = await User.findById(decodedToken[1].id)

    const post = new Post({
        author: user._id,
        title: req.body.title,
        content: req.body.content
    })

    const savedPost = await post.save()

    res.json(savedPost)
})

app.get('/api/posts/:id', async (req, res) => {
    if (!authenticate(req)){
        return res.status(401).json({ error: 'invalid request. Authentication failed' })
    }

    const post = await Post.findById(req.params.id)
        .populate('author', { username: 1 })
        .populate('comments', { author: 1, content: 1 })
        .populate('likes', { username: 1 })

    if (post) {
        res.json(post)
    } else {
        res.status(404).end()
    }
})

app.put('/api/posts/:id', async (req, res) => {
    if(!req.headers.authorization){
        return res.status(401).json({ error: 'invalid authorization' })

    }
    const token = req.headers.authorization.split(' ')[1]
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    if (!token || !decodedToken.id) {
        return res.status(401).json({ error: 'token missing or invalid' })

    }

    const post = await Post.findById(req.params.id)

    if (post.author.toString() !== decodedToken.id) {
        return res.status(401).json({ error: 'unauthorized' })
    }

    post.content = req.body.content

    const savedPost = await post.save()

    res.json(savedPost)
})

app.delete('/api/posts/:id', async (req, res) => {
    if(!req.headers.authorization){
        return res.status(401).json({ error: 'invalid authorization' })

    }
    const token = req.headers.authorization.split(' ')[1]
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    if (!token || !decodedToken.id) {
        return res.status(401).json({ error: 'token missing or invalid' })
    }

    const post = await Post.findById(req.params.id)

    if (post.author.toString() !== decodedToken.id) {
        return res.status(401).json({ error: 'unauthorized' })
    }

    await Post.findByIdAndRemove(req.params.id)

    res.status(204).end()
})

// Comment routes
app.post('/api/comments/:id', async (req, res) => {
    let decodedToken = authenticate(req);

    if (!decodedToken[0]){
        return res.status(401).json({ error: 'invalid request. Authentication failed' })
    }

    const user = await User.findById(decodedToken[1].id)
    const post = await Post.findById(req.params.id)

    if (user._id.equals(post.author._id)){
        return res.status(401).json({ error: 'invalid request. You are not allowed to comment on this post' })

    }

    const comment = new Comment({
        author: user._id,
        content: req.body.content
    })

    const savedComment = await comment.save()


    post.comments.push(new Comment(savedComment))

    await post.save()

    res.json(savedComment)
})

app.put('/api/comments/:id', async (req, res) => {
    const token = req.headers.authorization.split(' ')[1]
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    if (!token || !decodedToken.id) {
        return res.status(401).json({ error: 'token missing or invalid' })
    }

    const comment = await Comment.findById(req.params.id)

    if (comment.author.toString() !== decodedToken.id) {
        return res.status(401).json({ error: 'unauthorized' })
    }

    comment.content = req.body.content

    const savedComment = await comment.save()

    res.json(savedComment)
})

app.delete('/api/comments/:id', async (req, res) => {
    let decodedToken = authenticate(req);

    if (!decodedToken[0]){
        return res.status(401).json({ error: 'invalid request. Authentication failed' })
    }
    const comment = await Comment.findById(req.params.id)

    if (!comment.author._id.equals(decodedToken[1].id)){
        return res.status(401).json({ error: 'unauthorized access' })

    }

    const post = await Post.findById(comment.post)

    post.comments = post.comments.filter(c => c.toString() !== comment._id.toString())

    await post.save()

    await Comment.findByIdAndRemove(req.params.id)

    res.status(204).end()
})

app.get('/api/comments/:id', async (req, res) => {
    if (!authenticate(req)){
        return res.status(401).json({ error: 'invalid request. Authentication failed' })
    }

    const post = await Post.findById(req.params.id)
        .populate('author', { username: 1 })
        .populate('comments', { author: 1, content: 1 })
        .populate('likes', { username: 1 })

    if (post) {
        res.json(post.comments)
    } else {
        res.status(404).end()
    }
})

// Like routes
app.post('/api/likes/:id', async (req, res) => {
    let decodedToken = authenticate(req);

    if (!decodedToken[0]){
        return res.status(401).json({ error: 'invalid request. Authentication failed' })
    }

    const user = await User.findById(decodedToken[1].id)
    const post = await Post.findById(req.params.id)

    if (user._id.equals(post.author._id)){
        return res.status(401).json({ error: 'invalid request. You are not allowed to like this post' })
    }

    if (post.likes.includes(user._id)) {
        return res.status(400).json({ error: 'already liked' })
    }

    post.likes = post.likes.concat(user._id)

    await post.save()

    res.json(post)
})

app.get('/api/likes/:id', async (req, res) => {
    if (!authenticate(req)){
        return res.status(401).json({ error: 'invalid request. Authentication failed' })
    }

    const post = await Post.findById(req.params.id)
        .populate('author', { username: 1 })
        .populate('comments', { author: 1, content: 1 })
        .populate('likes', { username: 1 })

    if (post) {
        res.json(post.likes)
    } else {
        res.status(404).end()
    }
})

app.delete('/api/likes/:id', async (req, res) => {
    let decodedToken = authenticate(req);

    if (!decodedToken[0]){
        return res.status(401).json({ error: 'invalid request. Authentication failed' })
    }

    const user = await User.findById(decodedToken[1].id)

    const post = await Post.findById(req.params.id)

    post.likes = post.likes.filter(u => u.toString() !== user._id.toString())

    await post.save()

    res.json(post)
})


const PORT = process.env.PORT || 3000
app.listen(PORT,()=>{
    console.log(`server running on port ${PORT}`)
})