const mongoose = require('mongoose')

const commentSchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: String
})
module.exports = mongoose.model('Comment', commentSchema)
