const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title:{
    type:String,
    required:true
  },
  category: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true
  },
  condition: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  bookImages: {
    type: Array,
    required: true
  },
  ownerName:{
    type: String,
    required: true
  },
  contactNumber:{
    type: String,
    required: true
  },
  contactEmail:{
    type: String,
    required: true
  },
  address:{
    type:String,
    required:true
  }
});

const Book = mongoose.model('Book', bookSchema);

module.exports = Book;
