require ('dotenv').config()

const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const bcrypt  = require('bcryptjs')
const jwt = require('jsonwebtoken')

const userSchema = require('model/User')
const postSchema = require('model/Post')
const commentSchema = require('model/Comment')

const app = express()
app.use(cors())
app.use(express.json())

mongoose.connect(process.env.DB_URL,{
    useNewUrlParser: true,
    useUnifiedTopology:true,
    useCreateIndex: true
}).then(()=>{
    console.log('Connected to MongoDB')
}).catch((error)=>{
    console.log('Error Connecting to MongoDB:',error.message)
})

// Data models
const User = mongoose.model('User', userSchema)
const Post = mongoose.model('Post', postSchema)
const Comment = mongoose.model('Comment', commentSchema)

// Authentication routes
app.post('/register', async (req, res) => {
    try {
        const saltRounds = 10
        const passwordHash = await bcrypt.hash(req.body.password, saltRounds)
        const user = new User({
            username: req.body.username,
            passwordHash
        })

        const savedUser = await user.save()

        res.json(savedUser)

    } catch (error) {
        res.status(400).json({ error: error.message })
    }
})
app.post('/login', async (req, res) => {
    const user = await User.findOne({ username: req.body.username })
    const passwordCorrect = user === null
        ? false
        : await bcrypt.compare(req.body.password, user.passwordHash)

    if (!(user && passwordCorrect)) {
        return res.status(401).json({ error: 'invalid username or password' })
    }

    const userForToken = {
        username: user.username,
        id: user._id
    }

    const token = jwt.sign(userForToken, process.env.JWT_SECRET)

    res.status(200).json({ token, username: user.username })
})

// Post routes
app.get('/posts', async (req, res) => {
    const posts = await Post.find({})
        .populate('author', { username: 1 })
        .populate('comments', { author: 1, content: 1 })
        .populate('likes', { username: 1 })

    res.json(posts)
})

app.post('/posts', async (req, res) => {
    const token = req.headers.authorization.split(' ')[1]
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    if (!token || !decodedToken.id) {
        return res.status(401).json({ error: 'token missing or invalid' })
    }

    const user = await User.findById(decodedToken.id)

    const post = new Post({
        author: user._id,
        content: req.body.content
    })

    const savedPost = await post.save()

    res.json(savedPost)
})

app.get('/posts/:id', async (req, res) => {
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

app.put('/posts/:id', async (req, res) => {
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

app.delete('/posts/:id', async (req, res) => {
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
app.post('/comments', async (req, res) => {
    const token = req.headers.authorization.split(' ')[1]
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    if (!token || !decodedToken.id) {
        return res.status(401).json({ error: 'token missing or invalid' })
    }

    const user = await User.findById(decodedToken.id)

    const comment = new Comment({
        author: user._id,
        content: req.body.content
    })

    const savedComment = await comment.save()

    const post = await Post.findById(req.body.postId)

    post.comments = post.comments.concat(savedComment._id)

    await post.save()

    res.json(savedComment)
})

app.put('/comments/:id', async (req, res) => {
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

app.delete('/comments/:id', async (req, res) => {
    const token = req.headers.authorization.split(' ')[1]
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    if (!token || !decodedToken.id) {
        return res.status(401).json({ error: 'token missing or invalid' })
    }

    const comment = await Comment.findById(req.params.id)

    if (comment.author.toString() !== decodedToken.id) {
        return res.status(401).json({ error: 'unauthorized' })
    }

    const post = await Post.findById(comment.post)

    post.comments = post.comments.filter(c => c.toString() !== comment._id.toString())

    await post.save()

    await Comment.findByIdAndRemove(req.params.id)

    res.status(204).end()
})

// Like routes
app.post('/likes/:id', async (req, res) => {
    const token = req.headers.authorization.split(' ')[1]
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    if (!token || !decodedToken.id) {
        return res.status(401).json({ error: 'token missing or invalid' })
    }

    const user = await User.findById(decodedToken.id)
    const post = await Post.findById(req.params.id)

    if (post.likes.includes(user._id)) {
        return res.status(400).json({ error: 'already liked' })
    }

    post.likes = post.likes.concat(user._id)

    await post.save()

    res.json(post)
})

app.delete('/likes/:id', async (req, res) => {
    const token = req.headers.authorization.split(' ')[1]
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)

    if (!token || !decodedToken.id) {
        return res.status(401).json({ error: 'token missing or invalid' })
    }

    const user = await User.findById(decodedToken.id)

    const post = await Post.findById(req.params.id)

    post.likes = post.likes.filter(u => u.toString() !== user._id.toString())

    await post.save()

    res.json(post)
})

const PORT = process.env.PORT || 3000
app.listen(PORT,()=>{
    console.log(`server running on port ${PORT}`)
})