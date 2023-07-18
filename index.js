const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
require("dotenv").config();
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.et32bhj.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("houseDB").collection("users");
    const houseCollection = client.db("houseDB").collection("houses");
    const bookingCollection = client.db("houseDB").collection("booking");

    // User Related API's

    // Signup user
    app.post("/signup", async (req, res) => {
      const { name, email, password, role } = req.body;
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
      const query = { email: email };
      //   check existing user
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist" });
      }
      const newUser = { name, email, password: hashedPassword, role };
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    app.post("/login", async (req, res) => {
      const { email, password } = req.body;
      const user = await userCollection.findOne({ email });
      // If user not found or password doesn't match, return an error
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).send("Authorization Failure!");
      }
      const token = jwt.sign({ userId: user._id }, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send(token);
    });

    // Get current user
    app.get("/currentuser", async (req, res) => {
      const token = req.headers.authorization;
      if (!token) {
        return res
          .status(401)
          .send({ message: "Authorization token not found" });
      }
      //   console.log(token);

      //   verify token
      jwt.verify(token, process.env.ACCESS_TOKEN, async (err, decoded) => {
        if (err) {
          return res.status(401).send("Invalid token");
        }

        const user = await userCollection.findOne({
          _id: new ObjectId(decoded.userId),
        });
        // console.log(user);

        if (!user) {
          return res.status(404).send("User not found");
        }

        res.send(user);
      });
    });

    //  check current user admin or not
    app.get("/owner/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { owner: user?.role === "owner" };
      res.send(result);
    });

    // House Related API's
    // get all house
    app.get("/houses", async (req, res) => {
      const result = await houseCollection.find().toArray();
      res.send(result);
    });

    // get house by owner email
    app.get("/ownhouse/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await houseCollection.find().toArray(query);
      res.send(result);
    });

    // get house by id
    app.get("/house/:id", async (req, res) => {
      const id = req.params.id;
      //   console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await houseCollection.findOne(query);
      res.send(result);
    });

    // get user booking
    app.get("/mybooking/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    // post booking
    app.post("/mybooking", async (req, res) => {
      const bookHouse = req.body;
      const { houseId, email } = bookHouse;
      const query = { houseId: houseId, email: email };
      const existingBooking = await bookingCollection.findOne(query);
      if (existingBooking) {
        return res.send({ message: "This house already booked" });
      }
      const result = await bookingCollection.insertOne(bookHouse);
      res.send(result);
    });

    // delete a booking
    app.delete("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    // House Owner Booking
    app.get("/bookedhouse/:email", async (req, res) => {
      const email = req.params.email;
      const query = { owner_email: email };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    // approved booking
    app.patch("/approvedbooking/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateStatus = {
        $set: {
          status: "approved",
        },
      };
      const result = await bookingCollection.updateOne(filter, updateStatus);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close()
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("House Hunter server is running");
});
app.listen(port, () => {
  console.log(`House Hunter is running on port ${port}`);
});
