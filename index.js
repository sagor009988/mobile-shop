const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

var app = express();
const port = process.env.PORT || 4000;

// middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());

// token verification

const verifyJwt = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.send({ message: "No token" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_KEY_TOKEN, (err, decoded) => {
    if (err) {
      return res.send({ message: "Invalid token" });
    }
    req.decoded = decoded;
    next();
  });
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
};
// verify se

const verifyBuyer = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userCollection.findOne(query);
  if (user?.role == "Seller" || user?.role == "Admin") {
    return req.send({ message: "User must be buyer" });
  }
  next();
};

// mongodb connect

const url = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.okjp9zn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// collection

const userCollection = client.db("mobileShop").collection("users");
const productCollection = client.db("mobileShop").collection("products");

async function connectToDatabase() {
  try {
    await client.connect(); // Connect to MongoDB
    console.log("Connected to MongoDB successfully");

    // get user
    app.get("/users/:email", async (req, res) => {
      const query = { email: req.params.email };

      const user = await userCollection.findOne(query);
      if (!user) {
        return res.send({ message: "no user found" });
      }
      return res.send(user);
    });
    // get all users
    app.get("/users", async (req, res) => {
      const users = await userCollection.find().toArray();
      if (!users) {
        return res.send({ message: "no user found" });
      }
      return res.send(users);
    });

    // insert User
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User is already exist" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
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
      const { title, sort, category, brand, page = 1, limit = 6 } = req.query;

      const query = {};
      if (title) {
        query.title = { $regex: title, $options: "i" };
      }
      if (category) {
        query.category = { $regex: category, $options: "i" };
      }
      if (brand) {
        query.brand = brand;
      }

      const sortOption = sort == "asc" ? 1 : -1;

      const pageNumber = Number(page);
      const limitNumber = Number(limit);

      const products = await productCollection
        .find(query)
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .sort({ price: sortOption })
        .toArray();

      // total products

      const totalProducts = await productCollection.countDocuments(query);

      // brand and category differ from all

      // const productsInfo = await productCollection.find({}, { projection: { category: 1, brand: 1 } }).toArray();

      const categories = [
        ...new Set(products.map((product) => product.category)),
      ];
      const brands = [...new Set(products.map((product) => product.brand))];

      res.json({ products, categories, brands, totalProducts });
    });

    // my products
    app.get("/products", async (req, res) => {
      try {
        const products = await productCollection.find().toArray();
        res.send(products);
      } catch (err) {
        console.error("Error fetching products:", err.message);
        res.status(500).send({ message: "Failed to fetch products" });
      }
    });

    // add to wishlist
    app.patch("/wishlist/add", async (req, res) => {
      const { userEmail, productId } = req.body;
      const result = await userCollection.updateOne(
        { email: userEmail },
        { $addToSet: { wishlist: new ObjectId(String(productId)) } }
      );
      res.send(result);
    });

    // get wishlist data

    // get wishlist data
    app.get("/wishlist/:userId", async (req, res) => {
      try {
        const userId = req.params.userId;
        const user = await userCollection.findOne({
          _id: new ObjectId(userId),
        });

        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        const wishlist = await productCollection
          .find({ _id: { $in: user.wishlist || [] } })
          .toArray();

        res.send(wishlist);
      } catch (error) {
        res
          .status(400)
          .send({ message: "Invalid UserId format", error: error.message });
      }
    });

    // remove from wishlist

    app.patch("/wishlist/remove", async (req, res) => {
      const { userEmail, productId } = req.body;
      const result = await userCollection.updateOne(
        { email: userEmail },
        { $pull: { wishlist: new ObjectId(productId) } }
      );
      res.send(result);
    });

    // get product details
    app.get("/product/:id", async (req, res) => {
      try {
        const productId = req.params.id;
        const result = await productCollection.findOne({
          _id: new ObjectId(productId),
        });

        if (!result) {
          return res.status(404).send({ message: "Product not found" });
        }

        res.send(result);
      } catch (error) {
        res
          .status(400)
          .send({ message: "Invalid ProductId format", error: error.message });
      }
    });

    // add to cart
    app.patch("/cart/add", async (req, res) => {
      const { userEmail, productId } = req.body;
      const result = await userCollection.updateOne(
        { email: userEmail },
        { $addToSet: { cart: new ObjectId(String(productId)) } }
      );
      res.send(result);
    });

    // get to cart

    // get wishlist data
    app.get("/cart/:userId", async (req, res) => {
      try {
        const userId = req.params.userId;
        const user = await userCollection.findOne({
          _id: new ObjectId(userId),
        });

        if (!user) {
          return res.status(404).send({ message: "cart product not found" });
        }

        const wishlist = await productCollection
          .find({ _id: { $in: user.wishlist || [] } })
          .toArray();

        res.send(wishlist);
      } catch (error) {
        res
          .status(400)
          .send({ message: "Invalid UserId format", error: error.message });
      }
    });

    // remove data from cart

    // remove from wishlist

    app.patch("/cart/remove", async (req, res) => {
      const { userEmail, productId } = req.body;
      const result = await userCollection.updateOne(
        { email: userEmail },
        { $pull: { wishlist: new ObjectId(productId) } }
      );
      res.send(result);
    });

    // get products details

    app.get("/product/:id", async (req, res) => {
      const query = req.params.id;
      const result = await productCollection.findOne({ _id: query });
      if (!result) {
        return res.send({ message: "Product not found" });
      }
      res.send(result);
    });

    // admin seller control
    
    app.patch("/users/:id/status", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body; 

      try {
        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );

        if (result.modifiedCount > 0) {
          res.send({
            message: `User status updated to ${status}`,
            modifiedCount: result.modifiedCount,
          });
        } else {
          res
            .status(404)
            .send({ message: "User not found or status not changed" });
        }
      } catch (error) {
        console.error("Error updating status:", error.message);
        res.status(500).send({ message: "Internal server error" });
      }
    });
  } catch (err) {
    console.error("Error connecting to MongoDB:", err.message);
  }
}

// Call the function to connect to the database
connectToDatabase();

// api run check

app.get("/", (req, res) => {
  res.send("Hello World!");
});

//  jwt
app.post("/authentication", async (req, res) => {
  const userEmail = req.body;
  const token = jwt.sign(userEmail, process.env.ACCESS_KEY_TOKEN, {
    expiresIn: "10d",
  });
  res.send({ token });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
