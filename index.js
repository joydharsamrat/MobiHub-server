const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ihoeb4c.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
const categoriesCollection = client.db('mobihub').collection('productcategories');
const usersCollection = client.db('mobihub').collection('users');
const productsCollection = client.db('mobihub').collection('products');
const bookedProductsCollection = client.db('mobihub').collection('bookedProducts');

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('Unauthorized access')
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send('forbidden access')
        }
        req.decoded = decoded;
        next()
    })
}

async function verifySeller(req, res, next) {
    const userEmail = req.query.email;
    const query = { email: userEmail }
    const user = await usersCollection.findOne(query);
    if (user?.role !== "seller") {
        return res.status(401).send({ message: "unauthorized user" })
    }
    next()
}
async function verifyAdmin(req, res, next) {
    const userEmail = req.query.email;
    const query = { email: userEmail }
    const user = await usersCollection.findOne(query);
    if (user?.role !== "admin") {
        return res.status(401).send({ message: "unauthorized user" })
    }
    next()
}

async function run() {
    try {
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query)
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '10d' });
                return res.send({ accessToken: token })
            }
            res.status(401).send({ accessToken: '' })
        })


        app.get('/categories', async (req, res) => {
            const categories = await categoriesCollection.find({}).toArray();
            res.send(categories)
        })

        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' })
        })

        app.get('/users/seller/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const isVerified = user.verified;
            res.send({ isSeller: user?.role === 'seller', isVerified })
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "user already existed." })
            }
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })

        app.get('/buyers', verifyJWT, verifyAdmin, async (req, res) => {
            const query = { role: "buyer" };
            const buyers = await usersCollection.find(query).toArray();
            res.send(buyers)
        })
        app.get('/sellers', verifyJWT, verifyAdmin, async (req, res) => {
            const query = { role: "seller" };
            const sellers = await usersCollection.find(query).toArray();
            res.send(sellers)
        })

        app.get('/products/:id', verifyJWT, async (req, res) => {
            id = req.params.id;
            const query = { categoryId: id, status: 'available' }
            const options = { sort: { posted_at: -1 } }
            const result = await productsCollection.find(query, options).toArray();
            res.send(result);
        })
        app.get('/reported', verifyJWT, verifyAdmin, async (req, res) => {
            const query = { reported: true };
            const products = await productsCollection.find(query).toArray();
            console.log('reported', products)
            res.send(products)
        })
        app.get('/SellerProducts', verifyJWT, verifySeller, async (req, res) => {
            const email = req.query.email;
            const query = { sellerEmail: email }
            const options = { sort: { posted_at: -1 } }
            const products = await productsCollection.find(query, options).toArray()
            res.send(products)
        })

        app.post('/products', verifyJWT, verifySeller, async (req, res) => {
            const product = req.body;
            req.body.posted_at = new Date()
            const result = await productsCollection.insertOne(product)
            res.send(result)
        })

        app.get('/advertisedProducts', async (req, res) => {
            const query = { advertised: true };
            const result = await productsCollection.find(query).toArray();
            res.send(result)
        })

        app.put('/products/advertised/:id', verifyJWT, verifySeller, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    advertised: true
                }
            }
            const result = await productsCollection.updateOne(query, updatedDoc, options);
            res.send(result)
        })

        app.delete('/products/:id', verifyJWT, verifySeller, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(query)
            res.send(result)
        })

        app.get('/booked', verifyJWT, async (req, res) => {
            const email = req.query.email;
            console.log()
            const query = { buyerEmail: email }
            const options = { sort: { booked_at: -1 } }
            const products = await bookedProductsCollection.find(query, options).toArray();
            res.send(products)
        })

        app.get('/booked/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const query = { _id: ObjectId(id) };
            const product = await bookedProductsCollection.findOne(query)
            res.send(product);
        })

        app.post('/booked', verifyJWT, async (req, res) => {
            const product = req.body;
            const query = { buyerEmail: product.buyerEmail, productId: product.productId }
            const alreadyBooked = await bookedProductsCollection.findOne(query);
            if (alreadyBooked) {
                return res.send({ message: "can't book same product more than once" })
            }
            req.body.booked_at = new Date()
            const result = await bookedProductsCollection.insertOne(product)
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