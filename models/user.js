const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new mongoose.Schema({
  name:{
    type:String,
    required:true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  bookAds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }]

});

userSchema.plugin(passportLocalMongoose);


module.exports = mongoose.model("User", userSchema);

