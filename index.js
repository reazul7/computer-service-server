const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = 5080;

// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jeedbou.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const userCollection = client.db("computerServiceDB").collection("users");
        const serviceCollection = client.db("computerServiceDB").collection("service");
        const reviewsCollection = client.db("computerServiceDB").collection("reviews");
        const cartsCollection = client.db("computerServiceDB").collection("carts");

        // jwt related api
        app.post("/jwt", async(req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "1h"
            })
            res.send({ token });
        })

        // middlewares
        const verifyToken = (req, res, next) => {
            console.log("inside verify token", req.headers)
            if(!req.headers.authorization){
                return res.status(401).send({ message: "Unauthorized Access" })
            }
            const token = req.headers.authorization.split(" ")[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
                if (err) {
                    return res.status(401).send({ message: "Unauthorized Access" })
                }
                req.decode = decode;
                next();
            })
        }

        // verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decode.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === "admin";
            if (!isAdmin) {
                res.status(403).send({ message: "Forbidden Access" })
            }
            next();
        }

        // users related api
        app.post("/users", async (req, res) => {
            const user = req.body;
            // insert email if user does not exist
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (!existingUser) {
                const result = await userCollection.insertOne(user);
                res.send(result);
            } else {
                res.send({message: "User already exists", insertedId: null});
            }
        })
        app.get("/users", verifyToken, verifyAdmin, async(req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })
        app.get("/users/admin/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            if(email !== req.decode.email){
                return res.status(403).send({ message: "Forbidden Access" })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === "admin";
            }
            res.send({ admin });
        })

        app.patch("/users/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: "admin"
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc );
            res.send(result);
        })
        app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        // --------- menu related api ---------
        // service api
        app.get("/service", async(req, res) => {
            const result = await serviceCollection.find().toArray();
            res.send(result);
        })
        app.post("/service", verifyToken, verifyAdmin, async(req, res) => {
            const service = req.body;
            const result = await serviceCollection.insertOne(service);
            res.send(result);
        });
        app.delete("/service/:id", verifyToken, verifyAdmin, async(req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await serviceCollection.deleteOne(query);
            res.send(result);
        })


        app.get("/reviews", async(req, res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result);
        })

        // Get carts data find by email
        app.get("/carts", async(req, res) => {
            const email = req.query.email;
            const query = {email: email};
            const result = await cartsCollection.find(query).toArray();
            res.send(result);
        })
        // Insert a new chart in the chart
        app.post("/carts", async(req, res) => {
            const cartItem = req.body
            const result = await cartsCollection.insertOne(cartItem);
            res.send(result);
        })

        // Delete a chart by id
        app.delete("/carts/:id", async(req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartsCollection.deleteOne(query);
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => res.send('Hello World!'));

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));