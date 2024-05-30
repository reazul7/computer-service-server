const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
        const paymentCollection = client.db("computerServiceDB").collection("payments");

        // jwt related api
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "1h"
            })
            res.send({ token });
        })

        // middlewares
        const verifyToken = (req, res, next) => {
            console.log("inside verify token", req.headers)
            if (!req.headers.authorization) {
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
        app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        app.get("/users/admin/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decode.email) {
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

        app.post("/users", async (req, res) => {
            const user = req.body;
            // insert email if user does not exist
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "User already exists", insertedId: null });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        app.patch("/users/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: "admin"
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc);
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
        app.get("/service", async (req, res) => {
            const result = await serviceCollection.find().toArray();
            res.send(result);
        })
        app.post("/service", verifyToken, verifyAdmin, async (req, res) => {
            const service = req.body;
            const result = await serviceCollection.insertOne(service);
            res.send(result);
        });
        app.delete("/service/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await serviceCollection.deleteOne(query);
            res.send(result);
        })

        app.get("/service/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await serviceCollection.findOne(query);
            res.send(result);
        })
        app.patch("/service/:id", async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    name: item.name,
                    description: item.description,
                    image: item.image,
                    category: item.category,
                    price: item.price,
                }
            }
            const result = await serviceCollection.updateOne(filter, updateDoc);
            res.send(result);
        })


        // reviews api
        app.get("/reviews", async (req, res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result);
        })

        app.post("/reviews", verifyToken, async (req, res) => {
            const service = req.body;
            console.log("service", service)
            const result = await reviewsCollection.insertOne(service);
            res.send(result);
        });

        app.get('/reviews/:email', verifyToken, async (req, res) => {
            const query = { email: req.params.email }
            if (req.params.email !== req.decode.email) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
            const result = await reviewsCollection.find(query).toArray();
            res.send(result);
        })

        // Get carts data find by email
        app.get("/carts", async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await cartsCollection.find(query).toArray();
            res.send(result);
        })
        // Insert a new chart in the chart
        app.post("/carts", async (req, res) => {
            const cartItem = req.body
            const result = await cartsCollection.insertOne(cartItem);
            res.send(result);
        })

        // Delete a chart by id
        app.delete("/carts/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartsCollection.deleteOne(query);
            res.send(result);
        })

        // payment related api
        // payment intent request
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount,
                currency: "usd",
                payment_method_types: ["card"]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        app.get('/payments/:email', verifyToken, async (req, res) => {
            const query = { email: req.params.email }
            if (req.params.email !== req.decode.email) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment);
            // delete each item from the cart
            const query = {
                _id: { $in: payment.cartIds.map(id => new ObjectId(id)) }
            };
            const deleteResult = await cartsCollection.deleteMany(query);
            res.send({ paymentResult, deleteResult });
        })


        // stats or analytics
        app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
            const users = await userCollection.estimatedDocumentCount();
            const serviceItems = await serviceCollection.estimatedDocumentCount();
            const orders = await paymentCollection.estimatedDocumentCount();

            const result = await paymentCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: "$price" },
                    }
                }
            ]).toArray();
            const revenue = result.length > 0 ? result[0].totalRevenue : 0;
            res.send({ users, serviceItems, orders, revenue });
        })

        // using aggregate pipeline
        app.get("/order-stats", verifyToken, verifyAdmin, async (req, res) => {
            try {
                const result = await paymentCollection.aggregate([
                    {
                        $unwind: '$serviceIds',
                    },
                    {
                        $addFields: {
                            serviceIds: {
                                $convert: {
                                    input: '$serviceIds',
                                    to: 'objectId',
                                    onError: 'null'
                                }
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "service",
                            localField: "serviceIds",
                            foreignField: "_id",
                            as: "serviceItems",
                        }
                    },
                    {
                        $unwind: "$serviceItems"
                    },
                    {
                        $group: {
                            _id: "$serviceItems.category",
                            quantity: { $sum: 1 },
                            revenue: { $sum: "$serviceItems.price" },
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            category: "$_id",
                            quantity: "$quantity",
                            revenue: "$revenue",
                        }
                    }
                ]).toArray();
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send("Error fetching order stats");
            }
        });


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => res.send('Hello World!'));

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));