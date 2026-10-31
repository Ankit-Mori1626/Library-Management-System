const { Schema, model } = require('mongoose');
const ref = n => ({ type: Schema.Types.ObjectId, ref: n });
exports.User = model('User', new Schema({
  name: String, email: { type: String, unique: true, lowercase: true }, password: String,
  role: { type: String, default: 'student' }, studentId: String, department: String, blocked: { type: Boolean, default: false },
  resetHash: String, resetExpires: Date,
}, { timestamps: true }));
exports.Book = model('Book', new Schema({
  title: { type: String, required: true }, author: { type: String, required: true }, genre: { type: String, default: 'General' },
  isbn: String, shelf: String, description: String, year: Number,
  copies: { type: Number, default: 1 }, available: { type: Number, default: 1 },
}, { timestamps: true }));
exports.Loan = model('Loan', new Schema({
  book: ref('Book'), user: ref('User'), issuedAt: { type: Date, default: Date.now }, dueAt: Date, returnedAt: Date,
  renewals: { type: Number, default: 0 }, fine: { type: Number, default: 0 }, finePaid: { type: Boolean, default: false },
}));
// status: waiting -> ready (a copy is held for the student) -> done | cancelled
exports.Reservation = model('Reservation', new Schema({ book: ref('Book'), user: ref('User'), status: { type: String, default: 'waiting' } }, { timestamps: true }));
