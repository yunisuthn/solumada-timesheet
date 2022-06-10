const mongoose = require('mongoose');

const Timesheet = mongoose.Schema({
    m_code:String,
    num_agent:String,
    projects: String,
    parent:String,
    amount:Number,
    date:String,
    time_start: String,
    time_end:String,
    task:String,
    validation:Boolean
})
module.exports = mongoose.model('Timesheet',Timesheet);
