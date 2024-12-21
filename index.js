const express = require('express')
var cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()

var app = express();
const port = process.env.PORT || 4000;


// middleware
app.use(cors(
    {
        origin: "http://localhost:5173"
    }
));
app.use(express.json());


// mongodb connect

const url = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.okjp9zn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

const client = new MongoClient(url, {
    useNewUrlParser: true, useUnifiedTopology: true, serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function connectToDatabase() {
    try {

        await client.connect(); // Connect to MongoDB
        console.log('Connected to MongoDB successfully');


    } catch (err) {
        console.error('Error connecting to MongoDB:', err.message);
    }
}


// Call the function to connect to the database
connectToDatabase();



// api run check

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})