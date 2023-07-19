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
    // await client.connect();

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

    // get only a user for user profile
    app.get("/profile/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // get user by id
    app.get("/getprofileinfo/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // update user profile
    app.put("/updateprofile/:id", async (req, res) => {
      const user = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateUser = {
        $set: {
          address: user.address,
          email: user.email,
          gender: user.gender,
          name: user.name,
          phone: user.phone,
          photo: user.photo,
        },
      };
      const result = await userCollection.updateOne(filter, updateUser);
      res.send(result);
    });

    // House Related API's
    // get all house
    app.get("/houses", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;

      const filter = {};

      // Apply city filter if provided
      if (req.query.city) {
        filter.city = req.query.city;
      }

      // Apply bedrooms filter if provided
      if (req.query.bedrooms) {
        filter.bedrooms = parseInt(req.query.bedrooms);
      }

      // Apply bathrooms filter if provided
      if (req.query.bathrooms) {
        filter.bathrooms = parseInt(req.query.bathrooms);
      }

      // Apply room size filter if provided
      if (req.query.room_size) {
        filter.room_size = req.query.room_size;
      }

      // Apply availability filter if provided
      if (req.query.availability_date) {
        filter.availability_date = req.query.availability_date;
      }

      // Apply rent per month range filter if provided
      if (req.query.minRent || req.query.maxRent) {
        filter.rent_per_month = {};
        if (req.query.minRent) {
          filter.rent_per_month.$gte = parseInt(req.query.minRent);
        }
        if (req.query.maxRent) {
          filter.rent_per_month.$lte = parseInt(req.query.maxRent);
        }
      }

      //   Calculate for pagination
      const totalCount = await houseCollection.countDocuments(filter);
      const totalPages = Math.ceil(totalCount / limit);
      const offset = (page - 1) * limit;

      const result = await houseCollection
        .find(filter)
        .skip(offset)
        .limit(limit)
        .toArray();
      res.send({ totalPages, currentPage: page, result });
    });

    // get house by owner email
    app.get("/ownhouse/:email", async (req, res) => {
      const email = req.params.email;
      const query = { owner_email: email };
      const result = await houseCollection.find(query).toArray(query);
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

    // add house
    app.post("/addhouse", async (req, res) => {
      const newHouse = req.body;
      const result = await houseCollection.insertOne(newHouse);
      res.send(result);
    });

    // update a house
    app.put("/updatehouse/:id", async (req, res) => {
      const id = req.params.id;
      const {
        address,
        availability_date,
        bathrooms,
        bedrooms,
        city,
        house_name,
        phone_number,
        picture,
        rent_per_month,
        room_size,
        description,
      } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateHouse = {
        $set: {
          address: address,
          availability_date: availability_date,
          bathrooms: bathrooms,
          bedrooms: bedrooms,
          city: city,
          house_name: house_name,
          phone_number: phone_number,
          picture: picture,
          rent_per_month: rent_per_month,
          room_size: room_size,
          description: description,
        },
      };
      const result = await houseCollection.updateOne(filter, updateHouse);
      res.send(result);
    });

    // Get house by search index
    const indexKeys = { title: 1, category: 1 };
    const indexOptions = { name: "house_name" };
    const result = await houseCollection.createIndex(indexKeys, indexOptions);

    //  search by house_name
    app.get("/housesearch/:text", async (req, res) => {
      const searchText = req.params.text;
      const query = searchText
        ? { house_name: { $regex: searchText, $options: "i" } }
        : {};
      const result = await houseCollection.find(query).toArray();
      res.send(result);
    });

    // search by filter
    // app.get("/housesfilter", async (req, res) => {
    //   const filter = {};
    //   console.log(req.query.minRent);

    //   // Apply city filter if provided
    //   if (req.query.city) {
    //     filter.city = req.query.city;
    //   }

    //   // Apply bedrooms filter if provided
    //   if (req.query.bedrooms) {
    //     filter.bedrooms = parseInt(req.query.bedrooms);
    //   }

    //   // Apply bathrooms filter if provided
    //   if (req.query.bathrooms) {
    //     filter.bathrooms = parseInt(req.query.bathrooms);
    //   }

    //   // Apply room size filter if provided
    //   if (req.query.room_size) {
    //     filter.room_size = req.query.room_size;
    //   }

    //   // Apply availability filter if provided
    //   if (req.query.availability_date) {
    //     filter.availability_date = req.query.availability_date;
    //   }

    //   // Apply rent per month range filter if provided
    //   if (req.query.minRent || req.query.maxRent) {
    //     filter.rent_per_month = {};
    //     if (req.query.minRent) {
    //       filter.rent_per_month.$gte = parseInt(req.query.minRent);
    //     }
    //     if (req.query.maxRent) {
    //       filter.rent_per_month.$lte = parseInt(req.query.maxRent);
    //     }
    //   }

    //   const result = await houseCollection.find(filter).toArray();
    //   res.send(result);
    // });

    // delete a house
    app.delete("/deletehouse/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await houseCollection.deleteOne(query);
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
