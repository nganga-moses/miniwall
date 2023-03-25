require ('dotenv').config()

const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const bcrypt  = require('bcryptjs')
const jwt = require('jsonwebtoken')

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

const PORT = process.env.PORT || 3000
app.listen(PORT,()=>{
    console.log(`server running on port ${PORT}`)
})