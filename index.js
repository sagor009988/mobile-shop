const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()

var app = express();
const port = process.env.PORT || 4000;


// middleware
app.use(cors(
    {
        origin: "http://localhost:5173",
        optionsSuccessStatus: 200,
    }
));
app.use(express.json());

// token verification

const verifyJwt = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.send({ message: "No token" })
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_KEY_TOKEN, (err, decoded) => {
        if (err) {
            return res.send({ message: "Invalid token" })
        }
        req.decoded = decoded;
        next()
    })
};

// verify seller

const verifySeller = async (req, res, next) => {
    const email = req.decoded.email;
    const query = { email: email };
    const user = await userCollection.findOne(query);
    if (user?.role !== "Seller") {
        return req.send({ message: "Forbidden Access" });
    }
    next();
}


// mongodb connect

const url = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.okjp9zn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

const client = new MongoClient(url, {
    useNewUrlParser: true, useUnifiedTopology: true, serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// collection

const userCollection = client.db("mobileShop").collection("users");
const productCollection = client.db("mobileShop").collection("products");

async function connectToDatabase() {
    try {

        await client.connect(); // Connect to MongoDB
        console.log('Connected to MongoDB successfully');

        // get user
        app.get("/users/:email", async (req, res) => {
            const query = { email: req.params.email };

            const user = await userCollection.findOne(query);
            if (!user) {
                return res.send({ message: "no user found" })
            }
            return res.send(user);
        })


        // insert User
        app.post("/users", async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "User is already exist" });
            }
            const result = await userCollection.insertOne(user);
            res.send(result)
        });



        // add products
        app.post("/add-products", verifyJwt, verifySeller, async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        });

        // get products

        app.get("/all-products", async (req, res) => {
            // name search 2.sort by price 3.filter by category 4.filter by brand
            const { title, sort, category, brand, page = 1, limit = 9 } = req.query;

            const query = {};
            if (title) {
                query.title = { $regex: title, $options: "i" }
            }
            if (category) {
                query.category = { $regex: category, $options: "i" }
            }
            if (brand) {
                query.brand = brand
            }

            const sortOption = sort == "asc" ? 1 : -1;

            const pageNumber = Number(page);
            const limitNumber = Number(limit);

            const products = await productCollection
                .find(query)
                .skip((pageNumber - 1) * limit)
                .limit(limitNumber)
                .sort({ price: sortOption })
                .toArray();

            // total products

            const totalProducts = await productCollection.countDocuments(query);

            // brand and category differ from all

            // const productsInfo = await productCollection.find({}, { projection: { category: 1, brand: 1 } }).toArray();

            const categories = [...new Set(products.map((product) => (product.category)))];
            const brands = [...new Set(products.map((product) => (product.brand)))];

            res.json({ products, categories, brands, totalProducts });

        });

        // my products
        app.get("/products", async (req, res) => {
            try {
                const products = await productCollection.find().toArray();
                res.send(products);
            } catch (err) {
                console.error('Error fetching products:', err.message);
                res.status(500).send({ message: "Failed to fetch products" });
            }
        });


    } catch (err) {
        console.error('Error connecting to MongoDB:', err.message);
    }
}


// Call the function to connect to the database
connectToDatabase();



// api run check

app.get('/', (req, res) => {
    res.send('Hello World!')
});

//  jwt
app.post("/authentication", async (req, res) => {
    const userEmail = req.body;
    const token = jwt.sign(userEmail, process.env.ACCESS_KEY_TOKEN, { expiresIn: '10d' });
    res.send({ token });
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})