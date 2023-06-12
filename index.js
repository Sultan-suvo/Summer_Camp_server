const express = require('express')
const cors = require('cors')
const stripe = require("stripe")(process.env.PAYMENY_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express()
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' })
  }
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.h2wm7t6.mongodb.net/?retryWrites=true&w=majority`;

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
    // await client.connect();

    const usersCollection = client.db("songDb").collection("users");
    const addClassesCollection = client.db("songDb").collection("addClasses");
    const popularClassesCollection = client.db("songDb").collection("classes");
    const instructorCollection = client.db("songDb").collection("instructor");
    const allinstructorsCollection = client.db("songDb").collection("allinstructors");
    const seletcetedClassCollection = client.db("songDb").collection("selectedclass");
    const paymentsCollection = client.db("songDb").collection("payment");


    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' })
      }
      next()
    }

    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result)
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query)

      if (existingUser) {
        return res.send({ message: 'User already exists' })
      }
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })


    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.send({ admin: false })
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query)

      const result = { admin: user?.role === 'admin' };
      res.send(result)
    })

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.send({ instructor: false })
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query)

      const result = { instructor: user?.role === 'instructor' };
      res.send(result)
    })



    app.get('/users/instructors', async (req, res) => {
      try {
        const instructors = await usersCollection.find({ role: 'instructor' }).toArray();
        res.send(instructors);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: true, message: 'Internal server error' });
      }
    });


    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)
    })


    app.get('/addClasses', async (req, res) => {
      const result = await addClassesCollection.find().toArray();
      res.send(result)
    })


    app.get('/instructor/classes', verifyJWT, async (req, res) => {
      const instructorEmail = req.decoded.email;
      const query = { instructorEmail };
      const result = await addClassesCollection.find(query).toArray();
      res.send(result);
    });


    app.post('/addClasses', async (req, res) => {
      const item = req.body;
      const result = await addClassesCollection.insertOne(item)
      res.send(result)
    })


    // Assuming you have the following route for updating the class status
    app.patch('/addClasses/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const classId = req.params.id;
      const status = 'approved'; // Update the status to "approved"

      try {
        const filter = { _id: new ObjectId(classId) };
        const updateDoc = { $set: { status } };
        const result = await addClassesCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount === 1) {
          res.send({ success: true, message: 'Class status updated to "approved"' });
        } else {
          res.status(404).send({ success: false, message: 'Class not found' });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: 'Failed to update class status' });
      }
    });



    app.patch('/addClasses/:id/deny', verifyJWT, verifyAdmin, async (req, res) => {
      const classId = req.params.id;
      const status = 'denied'; // Update the status to "denied"

      try {
        const filter = { _id: new ObjectId(classId) };
        const updateDoc = { $set: { status } };
        const result = await addClassesCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount === 1) {
          res.send({ success: true, message: 'Class status updated to "denied"' });
        } else {
          res.status(404).send({ success: false, message: 'Class not found' });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: 'Failed to update class status' });
      }
    });


    app.patch("/insertFeedback/:id", async (req, res) => {
      const id = req.params.id;
      const feedback = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: feedback,
        },
      };

      const result = await addClassesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });



    app.get('/classes', async (req, res) => {
      try {
        const approvedClasses = await addClassesCollection.find({ status: 'approved' }).toArray();
        res.send(approvedClasses);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: true, message: 'Internal server error' });
      }
    });

    app.get("/selectedclass", async (req, res) => {
      const email = req.query.email;
      const query = { userEmail: email };
      const result = await seletcetedClassCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/selectedclass", async (req, res) => {
      const selectedClass = req.body;
      const result = await seletcetedClassCollection.insertOne(selectedClass);
      res.send(result);
    });

    app.delete("/selectedclass/:id", async (req, res) => {
      const id = req.params.id;
      const result = await seletcetedClassCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });


    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: price * amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    app.get('/paymenthistory/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentsCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/paymenthistory", verifyJWT, async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      res.send(result);
    });


    app.get('/instructor', async (req, res) => {
      const result = await instructorCollection.find().toArray();
      res.send(result)
    })

    app.get('/allinstructors', async (req, res) => {
      const result = await allinstructorsCollection.find().toArray();
      res.send(result)
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


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})