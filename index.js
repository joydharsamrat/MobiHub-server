const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ihoeb4c.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const categoriesCollection = client.db('mobihub').collection('productcategories');
const usersCollection = client.db('mobihub').collection('users');
const productsCollection = client.db('mobihub').collection('products');

async function run() {
    try {

        app.get('/categories', async (req, res) => {
            const categories = await categoriesCollection.find({}).toArray();
            res.send(categories)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            console.log(user)
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })

        app.post('/products', async (req, res) => {

            const userEmail = req.query.email;
            const query = { email: userEmail }
            const user = await usersCollection.findOne(query);
            if (user.role !== "seller") {
                return { message: "unauthorized user" }
            }

            const product = req.body;
            const result = await productsCollection.insertOne(product)
            res.send(result)
        })
    }
    finally {

    }
}

run().catch(err => console.log(err))



app.get('/', (req, res) => {
    res.send('mobihub server is running')
})

app.listen(port, () => {
    console.log('server is running on port', port)
})