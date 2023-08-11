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

app.use(express.static('public'));



const User = require('./models/user');
const Book = require('./models/books'); 

app.use(
  session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

mongoose.connect('mongodb://127.0.0.1:27017/userData')
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.isAuthenticated();
  next();
});

app.get('/', async (req, res) => {
  try {

    const books = await Book.find();

    res.render('home', { books });
  } catch (err) {

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

app.post('/signup', (req, res) => {
  const { name, username, password } = req.body;

  User.register(new User({ name, username }), password, (err, user) => {
    if (err) {
      console.error('Error creating user:', err);
      res.status(500).send('Internal server error');
    } else {
      passport.authenticate('local')(req, res, () => {
        res.redirect('/sell');
      });
    }
  });
});


app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
}));

app.get('/logout', (req, res) => {
  req.logout(function (err) {
    if (err) {
      console.error('Error logging out:', err);
      return res.status(500).send('Internal server error');
    }
    res.redirect('/login');
  });
});

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

      const userWithBooks = await User.findById(req.user._id).populate('bookAds');
  
      const books = userWithBooks.bookAds;
  
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

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).send('Book not found');
    }
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

    let book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).send('Book not found');
    }

    book.name = name;
    book.category = category;
    book.price = price;
    book.condition = condition;
    book.description = description;
    book.bookImages = bookImages;

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

    const book = await Book.findById(bookId);

    book.bookImages.forEach(img => { 
      const imagePath = path.join(__dirname, 'public', img);
      fs.unlinkSync(imagePath);
    })

    await Book.findByIdAndRemove(bookId);

    const user = req.user;
    user.bookAds = user.bookAds.filter((id)=>id.toString() !== bookId);
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

    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).send('Book not found');
    }

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
