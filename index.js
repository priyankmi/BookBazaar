const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer=require("multer");
const path=require("path");
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const fs = require('fs');


const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(express.static('public'));



const User = require('./models/user');
const Book = require('./models/books'); // Update the path to the user model file

app.use(
  session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
  })
);

// Set up Passport.js
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport.js to use the LocalStrategy with the User model
passport.use(new LocalStrategy(User.authenticate()));

// Serialize and deserialize user
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

mongoose.connect('mongodb://127.0.0.1:27017/userData')
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });
// Custom middleware to check authentication status
app.use((req, res, next) => {
  // Check if the user is authenticated using passport's isAuthenticated method
  res.locals.isAuthenticated = req.isAuthenticated();
  next();
});
// Define your routes here
app.get('/', async (req, res) => {
  try {
    // Query the database to get all books
    const books = await Book.find();

    // Render the index.ejs template and pass the books array to it
    res.render('home', { books });
  } catch (err) {
    // Handle any errors that occur during the database query
    console.error('Error fetching books:', err);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/signup', (req, res) => {
  res.render('signup');
});

app.get('/login', (req, res) => {
  res.render('login');
});

// Register route
app.post('/signup', (req, res) => {
  const { name, username, password } = req.body;

  User.register(new User({ name, username }), password, (err, user) => {
    if (err) {
      console.error('Error creating user:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      passport.authenticate('local')(req, res, () => {
        res.redirect('/sell');
      });
    }
  });
});


// Login route
app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
}));

app.get('/logout', (req, res) => {
  req.logout(function (err) {
    if (err) {
      console.error('Error logging out:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.redirect('/login');
  });
});

// Set up multer for file upload handling
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage });

app.get('/sell', (req, res) => {
  if (req.isAuthenticated()) {
    res.render('sell');
  } else {
    res.redirect('/login');
  }
});

app.post('/sell', upload.array('bookImages', 5), async (req, res) => {
  const { title, category, price, condition, description, ownerName, contactNumber,contactEmail, address } = req.body;
  const bookImages = req.files.map(file => '/uploads/' + file.filename);

  try {
    const book = new Book({
      title,
      category,
      price,
      condition,
      description,
      bookImages,
      ownerName, 
      contactNumber,
      contactEmail, 
      address
    });
    await book.save();
    
    // Add the book's _id to the current user's bookAds array
    req.user.bookAds.push(book._id);
    await req.user.save();

    res.redirect("/")
  } catch (err) {
    console.error('Error saving book data:', err);
    res.status(500).send('Internal server error');
  }
});

app.get('/myBookAds',async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      // Fetch the current user with their populated bookAds array
      const userWithBooks = await User.findById(req.user._id).populate('bookAds');
  
      // Extract the books from the user's bookAds array
      const books = userWithBooks.bookAds;
  
      // Render the "myBooks" page and pass the books data to the view
      res.render('myBookAds', { books });
    } catch (err) {
      console.error('Error fetching books:', err);
      res.status(500).send('Internal server error');
    }
  } else {
    res.redirect('/login');
  }
  
});



app.get('/editBook/:id', async (req, res) => {
  try {
    const bookId = req.params.id;
    // Fetch the book data from the database based on the book ID
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).send('Book not found');
    }
    // Render the editBook.ejs template and pass the book data
    res.render('editBook', { book });
  } catch (err) {
    console.error('Error fetching book for editing:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/editBook/:id', upload.array('bookImages', 5), async (req, res) => {
  const { name, category, price, condition, description } = req.body;
  const bookId = req.params.id;
  const bookImages = req.files.map(file => '/uploads/' + file.filename);

  try {
    // Find the book by its ID
    let book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).send('Book not found');
    }

    // Update book details with form data
    book.name = name;
    book.category = category;
    book.price = price;
    book.condition = condition;
    book.description = description;
    book.bookImages = bookImages;

    // Save the updated book to the database
    await book.save();

    res.redirect('/myBookAds');
  } catch (err) {
    console.error('Error updating book data:', err);
    res.status(500).send('Internal server error');
  }
});

app.get('/removeAd/:id', async (req, res) => {
  try {
    const bookId = req.params.id;

    // Find the book by its ID
    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).send('Book not found');
    }

    // Delete the book images from the 'uploads' folder
    for (const imageUrl of book.bookImages) {
      const imagePath = path.join(__dirname, 'public', imageUrl);

      fs.unlinkSync(imagePath);
    }

    // Remove the book from the database
    await Book.findByIdAndRemove(bookId);

    // Remove the book's ID from the current user's bookAds array
    const user = req.user;
    user.bookAds = user.bookAds.filter((id) => id.toString() !== bookId);
    await user.save();

    res.redirect('/myBookAds');
  } catch (err) {
    console.error('Error removing book:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/viewDetails/:id', async (req, res) => {
  try {
    const bookId = req.params.id;

    // Fetch the book details from the database based on the book ID
    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).send('Book not found');
    }

    // Render the 'bookDetails' EJS template and pass the 'book' object to it
    res.render('bookDetails', { book });
  } catch (err) {
    console.error('Error fetching book details:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/99Book',async(req,res)=>{
  try {
    const books = await Book.find({ price: { $lte: 100 } });
    res.render('99Book', { books });
  } catch (err) {
    console.error('Error fetching books:', err);
    res.status(500).send('Internal server error');
  }
});

app.listen(3000, () => {
  console.log('Server is listening on port 3000');
});
