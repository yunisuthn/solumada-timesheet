const express = require("express");
const routeExp = express.Router();
const mongoose = require("mongoose");
const UserSchema = require("../models/User");
const TimesheetsSchema = require("../models/Timesheets");
const projectSchema = require("../models/Project");
const archiveSchema = require("../models/archive");
const nodemailer = require("nodemailer");
const moment = require("moment");
const ExcelFile = require("sheetjs-style");
var num_file = 1;
const fs = require('fs');
 
//Variable globale
var hours = 0;
var minutes = 0;
var data = [];
var totaltime = "";
var ws;
var date_data = [];

//Mailing
var transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "developpeur.solumada@gmail.com",
    pass: "S0!um2d2",
  },
});
function sendEmail(receiver, subject, text) {
  var mailOptions = {
    from: "Timesheets Optimum solution",
    to: receiver,
    subject: subject,
    html: text,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
}

//Page login
routeExp.route("/").get(async function (req, res) {
  session = req.session;
  if (session.occupation_u == "user") {
    res.redirect("/timedefine");
  } else if (session.occupation_a == "admin") {
    res.redirect("/management");
  } else {
    res.render("LoginPage.html", { erreur: "" });
  }
});

//Post login
routeExp.route("/login").post(async function (req, res) {
  session = req.session;
  await login(req.body.username,req.body.pwd,session,res);
});
async function login(username,password,session,res){
  mongoose
  .connect(
    "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
    {
      useUnifiedTopology: true,
      UseNewUrlParser: true,
    }
  )
  .then(async () => {
    var logger = await UserSchema.findOne({
      username: username,
      password: password,
    });
    if (logger) {
      if (logger.occupation == "user") {
        session.occupation_u = logger.occupation;
        session.m_code = logger.m_code;
        session.num_agent = logger.num_agent;
        res.redirect("/timedefine");
        
      } else {
         session.occupation_a = logger.occupation;
         session.admin = logger.username;
         session.request = {
          validation: true,
          occupation: "user",
        };
        res.redirect("/management"); 
      }
    } else {
      res.render("LoginPage.html", {
        erreur: "Email or password is wrong",
      });
    }
  });
}
//Reset password
routeExp.route("/reset").get(async function (req, res) {
  session = req.session;
  if (session.mailconfirm) {
    res.redirect("/code");
  } else {
    res.render("reset.html", { err: "" });
  }
});
//New password
routeExp.route("/code").post(async function (req, res) {
  session = req.session;
  var email = req.body.username;
  mongoose
    .connect(
      "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
      {
        useUnifiedTopology: true,
        UseNewUrlParser: true,
      }
    )
    .then(async () => {
      if (await UserSchema.findOne({ username: email })) {
        session.mailconfirm = email;
        session.code = randomCode();
        sendEmail(
          session.mailconfirm,
          "Verification code timesheets",
          htmlVerification(session.code)
        );
        res.redirect("/code");
      } else {
        res.render("reset.html", { err: "Username does not exist" });
      }
    });
});
//code
routeExp.route("/code").get(async function (req, res) {
  session = req.session;
  if (session.mailconfirm) {
    res.render("code.html", { err: "" });
  } else {
    res.redirect("/");
  }
});
//Check code
routeExp.route("/check").post(async function (req, res) {
  session = req.session;
  if (session.code == req.body.code) {
    res.send("match");
  } else {
    res.send("not");
  }
});
//Change password
routeExp.route("/change").post(async function (req, res) {
  var newpass = req.body.pass;
  session = req.session;
  mongoose
    .connect(
      "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
      {
        useUnifiedTopology: true,
        UseNewUrlParser: true,
      }
    )
    .then(async () => {
      await UserSchema.findOneAndUpdate(
        { username: session.mailconfirm },
        { password: newpass }
      );
      session.mailconfirm = null;
      session.code = null;
      res.send("Ok");
    });
});

//Management Page
routeExp.route("/management").get(async function (req, res) {
  session = req.session;
  session.filtrage = null;
  if (session.occupation_a == "admin") {
    res.render("ManagementPage.html",{admin:session.admin});
  } else {
    res.redirect("/");
  }
});

//Employees page
routeExp.route("/employees").get(async function (req, res) {
  session = req.session;
  if (session.occupation_a == "admin") {
    mongoose
      .connect(
        "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
        {
          useUnifiedTopology: true,
          UseNewUrlParser: true,
        }
      )
      .then(async () => {
        if (Object.keys(session.request).length == 2 || session.filtrage != ""){
              
          var timesheets = await TimesheetsSchema.find({ validation: true }).sort(
            { "_id": -1 }
          );
          session.datatowrite = timesheets;
        }
        var projects = await projectSchema.find({});
        res.render("Employees.html", {
          timesheets: session.datatowrite,
          available_project: projects,
          admin:session.admin
        });
      });
  } else {
    res.redirect("/");
  }
});
//New employee
routeExp.route("/newemployee").get(async function (req, res) {
  session = req.session;
  session.filtrage = null;
  if (session.occupation_a == "admin") {
    res.render("newemployee.html");
  } else {
    res.redirect("/");
  }
});
//Filter data

routeExp.route("/filter").post(async function (req, res) {
  session = req.session;
  if (session.occupation_a == "admin") {
    session.filtrage = "";
  var mcode = req.body.mcode;
  var project = req.body.project;
  var datestart = req.body.startdate;
  var dateend = req.body.enddate;
  var datecount = [];
  var datatosend = [];
  mongoose
    .connect(
      "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
      {
        useUnifiedTopology: true,
        UseNewUrlParser: true,
      }
    )
    .then(async () => {
      mcode == "" ? delete session.request.m_code : (session.request.m_code = {'$regex':mcode,'$options' : 'i'});
      project == "" ? delete session.request.projects : (session.request.projects = project);
      datestart == "" ? "" : datecount.push(1);
      dateend == "" ? "" : datecount.push(2);
      var parent_project = await projectSchema.findOne({project_name:project});
      if (parent_project){
           if (parent_project.parent == "y"){
          delete session.request.projects;
          session.request.parent = parent_project.project_name;
      }
        else{
          delete session.request.parent;
            }
      }
    else{
       delete session.request.parent;
    }
      if (datecount.length == 2) {
        var day = moment
          .duration(
            moment(dateend, "YYYY-MM-DD").diff(moment(datestart, "YYYY-MM-DD"))
          )
          .asDays();
        for (i = 0; i <= day; i++) {
          session.request.date = datestart;
          date_data.push(session.request.date);
          var getdata = await TimesheetsSchema.find(session.request).sort({
            "_id": -1,
          });
          if (getdata.length != 0) {
            datatosend.push(getdata);
          }
          var addday = moment(datestart, "YYYY-MM-DD")
            .add(1, "days")
            .format("YYYY-MM-DD");
          datestart = addday;
        }
        for (i = 1; i < datatosend.length; i++) {
         for (d=0;d<datatosend[i].length;d++){
            datatosend[0].push(datatosend[i][d]);
          }
        }
       if (datatosend.length != 0){
          session.datatowrite = datatosend[0];
          res.send(datatosend[0]);
        }
        else{
          session.datatowrite = datatosend;
          res.send(datatosend);
        }
      } else if (datecount.length == 1) {
        if (datecount[0] == 1) {
          session.request.date = datestart;
          datatosend = await TimesheetsSchema.find(session.request).sort({
            "_id": -1,
          });
          session.datatowrite = datatosend;
          res.send(datatosend);
        } else {
          session.request.date = dateend;
          datatosend = await TimesheetsSchema.find(session.request).sort({
            "_id": -1,
          });
          session.datatowrite = datatosend;
          res.send(datatosend);
        }
      } else {
        delete session.request.date;
        datatosend = await TimesheetsSchema.find(session.request).sort({
          "_id": -1,
        });
        session.datatowrite = datatosend;
        session.request.m_code = mcode;
        res.send(datatosend);
      }
    });
  }else{
    res.send("retour");
  }
});
//Add employee
routeExp.route("/addemp").post(async function (req, res) {
  session = req.session;
  if (session.occupation_a == "admin") {
  var email = req.body.email;
  var mcode = req.body.mcode;
  var num_agent = req.body.num_agent;
  var amount = req.body.amount;
  var first = req.body.first_name;
  var last = req.body.last_name;
  mongoose
    .connect(
      "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
      {
        useUnifiedTopology: true,
        UseNewUrlParser: true,
      }
    )
    .then(async () => {
      if (
        await UserSchema.findOne({
          $or: [
            { username: email },
            { m_code: mcode },
            { num_agent: num_agent },
          ],
          })
      ) {
        res.send("error");
      } else {
        var passdefault = randomPassword();
        var new_emp = {
          username: email,
          first_name:first,
          last_name:last,
          password: passdefault,
          m_code: mcode,
          num_agent: num_agent,
          occupation: "user",
          amount:amount,
        };
        var new_arch = {
          first_name:first,
          last_name:last,
          m_code: mcode,
        }
        await UserSchema(new_emp).save();
        await archiveSchema(new_arch).save();
        sendEmail(
          email,
          "Authentification Timesheets",
          htmlRender(email, passdefault)
        );
        res.send(email);
      }
    });
  }
  else{
   res.send("retour");
  }
});

//add new project
routeExp.route("/addproject").post(async function (req, res) {
  session = req.session;
  if (session.occupation_a == "admin") {
  var project = req.body.projet;
  var parent = req.body.parent;
  var new_project = {
    project_name: project,
    parent: parent,
  };
  mongoose
    .connect(
      "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
      {
        useUnifiedTopology: true,
        UseNewUrlParser: true,
      }
    )
    .then(async () => {
      if (await projectSchema.findOne({ project_name: project })) {
        res.send("Project " + project + " already exist");
      } else {
        await projectSchema(new_project).save();
        if(parent != ""){
            await projectSchema.findOneAndUpdate({project_name:parent},{parent:"y"});
        }
        res.send("Project " + project + " added successfuly");
      }
    });
  }else{
    res.redirect("/")
  }
});
// update project
routeExp.route("/updateproject").post(async function (req, res) {
  session = req.session;
  if (session.occupation_a == "admin") {
  var project = req.body.projet;
  var parent = req.body.parent;
  var opt = req.body.option;
  mongoose
    .connect(
      "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
      {
        useUnifiedTopology: true,
        UseNewUrlParser: true,
      }
    )
    .then(async () => {
      if (opt == "par"){
          await projectSchema.findOneAndUpdate({project_name:project},{parent:"y"});
      }
      else if (opt == "sub"){
          await projectSchema.findOneAndUpdate({project_name:parent},{parent:"y"});
          await projectSchema.findOneAndUpdate({project_name:project},{parent:parent});
          await TimesheetsSchema.updateMany({projects:project},{parent,parent});
      }
      res.send("Project updated successfuly");
    });
  }else{
    res.redirect("/")
  }
});
//Add Administrator
routeExp.route("/addadmin").post(async function (req, res) {
  session = req.session;
  if (session.occupation_a == "admin") {
  var email = req.body.mail;
  mongoose
  .connect(
    "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
    {
      useUnifiedTopology: true,
      UseNewUrlParser: true,
    }
  )
  .then(async () => {
    if (
      await UserSchema.findOne({username:email})
    ) {
      res.send("Admin already exist");
    } else {
      var passdefault = "timesheets"
      var new_emp = {
        username: email,
        password: passdefault,
        m_code: "",
        num_agent: "",
        occupation: "admin",
        amount:0,
      };
      await UserSchema(new_emp).save();
      sendEmail(
        email,
        "Authentification Timesheets",
        htmlRender(email, passdefault)
      );
      res.send(email + " successfully added");
    }
  });
}
else{
 res.send("retour");
}
});

//Validation page
routeExp.route("/validation").get(async function (req, res) {
  session = req.session;
  if (session.occupation_a == "admin") {
    session.filtrage = null;
    mongoose
      .connect(
        "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
        {
          useUnifiedTopology: true,
          UseNewUrlParser: true,
        }
      )
      .then(async () => {
        var timesheets = await TimesheetsSchema.find({ validation: false });
        res.render("Validation.html", { timesheets: timesheets });
      });
  } else {
    res.redirect("/");
  }
});
//Validation
routeExp.route("/validate").post(async function (req, res) {
  session = req.session;
  if (session.occupation_a == "admin") {
  var id = req.body.id;
  mongoose
    .connect(
      "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
      {
        useUnifiedTopology: true,
        UseNewUrlParser: true,
      }
    )
    .then(async () => {
      await TimesheetsSchema.findOneAndUpdate(
        { _id: id },
        { validation: true }
      );
      res.send("Ok");
    });
  }
  else{
  res.redirect("/");
  }
});
//Denied
routeExp.route("/denied").post(async function (req, res) {
  session = req.session;
  if (session.occupation_a == "admin") {
  var id = req.body.id;
  var m_code = req.body.m_code;
  var message = req.body.message;
  var task = req.body.task;
  var project = req.body.projetr;
  mongoose
    .connect(
      "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
      {
        useUnifiedTopology: true,
        UseNewUrlParser: true,
      }
    )
    .then(async () => {
      var user = await UserSchema.findOne({ m_code: m_code });
      await TimesheetsSchema.findOneAndDelete({ _id: id });
      var text =
        "<p>Hello,</p>" +
        "<p>Your task <b>" +
        task +
        "</b> in project <b>"+ project +"</b> is rejected because:</p>" +
        "<p style='margin-left:30px;'>" +
        message +
        "<p><p>Regards</p>";
      sendEmail(user.username, "Rejected Time logged", text);
      res.send("Ok");
    });
  }
  else{
    res.send("retour");
  }
});
//Validate all
routeExp.route("/valideall").post(async function (req, res) {
  session = req.session;
  if (session.occupation_a == "admin") {
    var opt = req.body.option;
    mongoose
      .connect(
        "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
        {
          useUnifiedTopology: true,
          UseNewUrlParser: true,
        }
      )
      .then(async () => {
        if (opt != ""){
          await TimesheetsSchema.updateMany({$or: [
            { m_code: { '$regex': opt, '$options': 'i' } },
            { num_agent: { '$regex': opt, '$options': 'i' } },
            { projects: { '$regex': opt, '$options': 'i' } },
            { date: { '$regex': opt, '$options': 'i' } }
        ],validation:false},{validation:true});
          res.send('part');
        }
        else{
          await TimesheetsSchema.updateMany(
            { validation: false },
            { validation: true }
          );
          res.send("ok");
        }
        
        
      });
  } else {
    res.redirect("/");
  }
});

//Project
routeExp.route("/about").get(async function (req, res) {
  session = req.session;
  if (session.occupation_a == "admin") {
    session.filtrage = null;
    mongoose
      .connect(
        "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
        {
          useUnifiedTopology: true,
          UseNewUrlParser: true,
        }
      )
      .then(async () => {
        var projects = await projectSchema.find({});
        res.render("Projects.html", { available_project: projects,admin:session.admin });
      });
  } else {
    res.redirect("/");
  }
});

//Project information
routeExp.route("/getinfo").post(async function (req, res) {
  session = req.session;
  if (session.occupation_a == "admin") {
    session.send = [];
  var project = req.body.project;
  mongoose
    .connect(
      "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
      {
        useUnifiedTopology: true,
        UseNewUrlParser: true,
      }
    )
    .then(async () => {
    var sub = await projectSchema.find({parent:project});
    if (sub.length == 0){
      var alltimes = await TimesheetsSchema.find({
        projects: project,
        validation: true,
      }).sort(
        { "date": 1 }
      );
      if (alltimes.length != 0){
        var amount = 0;
      const endOfMonth = moment().daysInMonth();
      var actually = 1;
      const startOfMonth = moment().startOf("month").format("YYYY-MM-DD");
      var datetosearch = startOfMonth;
      while (actually <= endOfMonth) {
        var one = await TimesheetsSchema.find({
          projects: project,
          date: datetosearch,
          validation: true,
        }).sort(
          { "date": 1 }
        );
        for (i = 0; i < one.length; i++) {
          calcul_timediff(one[i].time_start, one[i].time_end);
          amount += one[i].amount * timediff(one[i].time_start, one[i].time_end);
        }
        actually++;
        datetosearch = moment(datetosearch, "YYYY-MM-DD")
          .add(1, "days")
          .format("YYYY-MM-DD");
      }
      var timepassed = hours + " H : " + minutes + " MN";
      hours = 0;
      minutes = 0;
      var send = project_info(alltimes) + "," + timepassed + "," + amount.toFixed(2) + " €";
      session.send.push({
        name:project,
        infos:send
      });
      res.send(send);
      }
      else{
        res.send("error");
      }
    }
     else{
        var send ="";
        var timepassedh = 0;var timepassedmin=0; var timepassed1h=0;var timepassed1min=0; var amounts=0;var amount1=0;
        for (p=0;p<sub.length;p++){
          var project_name = sub[p].project_name;
          var alltimes = await TimesheetsSchema.find({
            projects: project_name,
            validation: true,
          }).sort(
            { "date": 1 }
          );
          if (alltimes.length != 0){
            var tab = [0,0,0,0,0,0];
            tab[0]+=timepassedh;tab[1]+=timepassedmin;tab[2]+=amounts;tab[3]+=timepassed1h;tab[4]+=timepassed1min;tab[5]+=amount1;
          var am = await UserSchema.findOne({m_code:alltimes[0].m_code});
          const endOfMonth = moment().daysInMonth();
          var actually = 1;
          const startOfMonth = moment().startOf("month").format("YYYY-MM-DD");
          var datetosearch = startOfMonth;
          while (actually <= endOfMonth) {
            var one = await TimesheetsSchema.find({
              projects:project_name,
              date: datetosearch,
              validation: true,
            }).sort(
              { "date": 1 }
            );
            for (i = 0; i < one.length; i++) {
              calcul_timediff(one[i].time_start, one[i].time_end);
              amount1 += one[i].amount * timediff(one[i].time_start, one[i].time_end);
            }
            actually++;
            datetosearch = moment(datetosearch, "YYYY-MM-DD")
              .add(1, "days")
              .format("YYYY-MM-DD");
          }
          timepassed1h += hours;
          timepassed1min += minutes;
          hours = 0;
          minutes = 0;

          var cum2 = project_info(alltimes,am.amount).split(',');
          timepassedh += parseInt(cum2[0].split(',')[0].split(' ')[0]);
          timepassedmin += parseInt(cum2[0].split(',')[0].split(' ')[3]);
          amounts += parseFloat(cum2[1].split(' ')[0]);
          while (timepassedmin >= 60) {
            timepassedh += 1;
            timepassedmin = timepassedmin - 60;
          }
          while (timepassed1min >= 60) {
            timepassed1h += 1;
            timepassed1min = timepassed1min - 60;
          }
          send = (timepassedh - parseInt(tab[0])) + " H : " + (timepassedmin - parseInt(tab[1])) + " MN," + (amounts.toFixed(2) - parseFloat(tab[2])) + " €," +  (timepassed1h - parseInt(tab[3])) + " H : " + (timepassed1min - parseInt(tab[4])) + " MN," + (amount1.toFixed(2) - parseFloat(tab[5])) + " €";
         
            session.send.push({
              name:sub[p].project_name,
              infos:send
            });
          }
          else{
            send = 0 + " H : " + 0 + " MN," + 0 + " €," +  0 + " H : " + 0 + " MN," + 0 + " €";
            session.send.push({
              name:sub[p].project_name,
              infos:send
            });
            send = timepassedh + " H : " + timepassedmin + " MN," + amounts.toFixed(2) + " €," +  timepassed1h + " H : " + timepassed1min + " MN," + amount1.toFixed(2) + " €";
          }    
        }
        send = timepassedh + " H : " + timepassedmin + " MN," + amounts.toFixed(2) + " €," +  timepassed1h + " H : " + timepassed1min + " MN," + amount1.toFixed(2) + " €";
        session.send.push({
          name:"",
          infos:send
        });
        if (send != "error"){
          send = timepassedh + " H : " + timepassedmin + " MN," + amounts.toFixed(2) + " €," +  timepassed1h + " H : " + timepassed1min + " MN," + amount1.toFixed(2) + " €";
          res.send(send);
        }
        else {
          res.send(send);
        }
        
      }
    });
  }
  else{
    res.send("retour");
  }
});
//Users List
routeExp.route("/userlist").get(async function (req, res) {
  session = req.session;
  if (session.occupation_a == "admin") {
  session.filtrage = null;
  mongoose
      .connect(
        "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
        {
          useUnifiedTopology: true,
          UseNewUrlParser: true,
        }
      )
      .then(async () => {
        var users = await UserSchema.find({});
        res.render("Userlist.html",{users:users,admin:session.admin});
      });
    }
    else{
      res.redirect("/");
    }
})
//getuser
routeExp.route("/getuser").post(async function (req, res) {
  var id = req.body.id;
  mongoose
  .connect(
    "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
    {
      useUnifiedTopology: true,
      UseNewUrlParser: true,
    }
  )
  .then(async () => {
    var user = await UserSchema.findOne({_id:id });
    res.send(user.first_name +","+user.last_name+","+user.m_code + ","+user.num_agent +","+user.amount);
  });
})
//Update User
routeExp.route("/updateuser").post(async function (req, res) {
  var id = req.body.id;
  var m_code = req.body.code;
  var num_agent = req.body.num;
  var amount = req.body.am;
  var first = req.body.first;
  var last = req.body.last;
  mongoose
  .connect(
    "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
    {
      useUnifiedTopology: true,
      UseNewUrlParser: true,
    }
  )
  .then(async () => {
    var user = await UserSchema.findOne({_id:id });
      await TimesheetsSchema.updateMany({m_code:user.m_code},{m_code:m_code,num_agent:num_agent});
      await UserSchema.findOneAndUpdate({_id:id },{m_code:m_code,num_agent:num_agent,amount:amount,first_name:first,last_name:last});
      await archiveSchema.findOneAndUpdate({m_code:m_code},{m_code:m_code,first_name:first,last_name:last});
      res.send("User updated successfully");
})
})
//Drop user 
routeExp.route("/dropuser").post(async function (req, res) {
  var names = req.body.fname;
  names = names.split(" ");
  mongoose
  .connect(
    "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
    {
      useUnifiedTopology: true,
      UseNewUrlParser: true,
    }
  )
  .then(async () => {
      await UserSchema.findOneAndDelete({first_name:names[0],last_name:names[1]});
      res.send("User deleted successfully");
})
})
//Define time page
routeExp.route("/timedefine").get(async function (req, res) {
  session = req.session;
  if (session.occupation_u == "user") {
    mongoose
      .connect(
        "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
        {
          useUnifiedTopology: true,
          UseNewUrlParser: true,
        }
      )
      .then(async () => {
        var projects = await projectSchema.find({ parent: { $ne: "y" } });
        res.render("Timedefine.html", { available_project: projects });
      });
  } else {
    res.redirect("/");
  }
});
//Savetime user
routeExp.route("/savetime").post(async function (req, res) {
  session = req.session;
  if (session.occupation_u == "user") {
  var project = req.body.project;
  var date = moment(req.body.date).format("YYYY-MM-DD");
  var start_time = req.body.start;
  var end_time = req.body.end;
  var task = req.body.task;
  var new_time = {
    m_code: session.m_code,
    num_agent: session.num_agent,
    projects: project,
    amount:0,
    date: date,
    time_start: start_time,
    time_end: end_time,
    task: task,
    validation: false,
  };
  mongoose
    .connect(
      "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
      {
        useUnifiedTopology: true,
        UseNewUrlParser: true,
      }
    )
    .then(async () => {
      var amount = await UserSchema.findOne({m_code:session.m_code});
      new_time.amount = amount.amount;
      var parent = await projectSchema.findOne({project_name:project});
      new_time.parent = parent.parent;
      await TimesheetsSchema(new_time).save();
        sendEmail(
          'andy.solumada@gmail.com',
          "Time logged",
          htmlAlert(session.m_code, project)
        );
      res.send("Time for task " + task + " saved");
    });
  }
  else{
   res.send("retour");
  }
});

//Generate excel file
routeExp.route("/generate").post(async function (req, res) {
  session = req.session;
  if (session.occupation_a == "admin") {
  var newsheet = ExcelFile.utils.book_new();
  newsheet.Props = {
    Title: "Timesheets",
    Subject: "Logged Time",
    Author: "Optimum solution",
  };
  mongoose
    .connect(
      "mongodb+srv://Rica:ryane_jarello5@cluster0.z3s3n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
      {
        useUnifiedTopology: true,
        UseNewUrlParser: true,
      }
    )
    .then(async () => {
      if (session.request.m_code) {
        var name_user = await UserSchema.findOne({m_code:session.request.m_code});
        data.push([
          name_user.last_name+" "+name_user.first_name + " SHEET",
          "",
          "",
          "",
          "",
          "",
          "",
        ]);
        data.push([
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]);
        data.push([
          "M-CODE",
          "Number Of Agent",
          "Project Name",
          "Date",
          "Task",
          "Start Time",
          "End Time",
        ]);
        generate_excel(session.datatowrite);
        if (newsheet.SheetNames.includes(name_user.m_code)){
        } else {
          newsheet.SheetNames.push(name_user.m_code);
        }
        newsheet.Sheets[name_user.m_code] = ws;
        hours = 0;
        minutes = 0;
        data = [];
        if (newsheet.SheetNames.length != 0) {
          session.filename = "N°"+num_file+ " " + name_user.m_code + ".xlsx";
          num_file++;
          ExcelFile.writeFile(newsheet, session.filename);
        }
        delete session.request.m_code;
        delete session.request.date;
        delete session.request.projects;
        delete session.request.date;
        delete session.request.parent;
      } else {
        var all_employes = [];
        for (i=0;i<session.datatowrite.length;i++){
           if (all_employes.includes(session.datatowrite[i].m_code)){

           }
           else{
             all_employes.push(session.datatowrite[i].m_code);
        }
        all_employes = all_employes.sort();
        
        }
        for (e = 0; e < all_employes.length; e++) {
          
          var name_user = await archiveSchema.findOne({m_code:all_employes[e]});
          data.push([
            "SHEET OF => "+name_user.last_name+" "+name_user.first_name,
            "",
            "",
            "",
            "",
            "",
            "",
          ]);
          data.push([
            "",
            "",
            "",
            "",
            "",
            "",
            "",
          ]);
          data.push([
            "M-CODE",
            "Number Of Agent",
            "Project Name",
            "Date",
            "Task",
            "Start Time",
            "End Time",
          ]);
          session.request.m_code = all_employes[e];
          var datanew = [];
          if (date_data.length != 0) {
            for (i = 0; i < session.datatowrite.length; i++) {
              if (session.datatowrite[i].m_code == all_employes[e]) {
                datanew.push(session.datatowrite[i]);
              }
            }
            generate_excel(datanew);
            datanew = [];
          } else {
            session.datatowrite = await TimesheetsSchema.find(session.request).sort(
              { "date": 1 }
            );
            generate_excel(session.datatowrite);
          }

          if (newsheet.SheetNames.includes(all_employes[e])) {
          } else {
            newsheet.SheetNames.push(all_employes[e]);
          }
          newsheet.Sheets[all_employes[e]] = ws;
          hours = 0;
          minutes = 0;
          data = [];
        }
        if (session.send && req.body.projet){
          data.push(["PROJECT(S)","TOTAL HOUR","TOTAL AMOUNT"]);
          var tot = session.send;
          if (tot.length != 1){
            for(i=0;i<tot.length;i++){
              if (i != tot.length - 1){
                data.push([tot[i].name,tot[i].infos.split(',')[0],tot[i].infos.split(',')[1]]);
              }
              else{
                data.push(["TOTAL",tot[i].infos.split(',')[0],tot[i].infos.split(',')[1]]);
              }
              
            }
          }
          else{
            data.push([tot[0].name,tot[0].infos.split(',')[0],tot[0].infos.split(',')[1]]);
          }
          newsheet.SheetNames.push("TOTAL");
          ws = ExcelFile.utils.aoa_to_sheet(data);
          ws["!cols"] = [
            {wpx: 200 },
            {wpx: 150},
            {wpx: 150},
          ];
          style1();
          newsheet.Sheets["TOTAL"] = ws;
          data= [];
        }
       
        if (newsheet.SheetNames.length != 0) {
          if (session.request.projects){
            session.filename ="N°"+num_file+" "+session.request.projects+".xlsx";
            num_file++;
            ExcelFile.writeFile(newsheet, session.filename);
          }
          else{
            session.filename = "N°"+num_file+" Timesheets.xlsx";
            num_file++;
            ExcelFile.writeFile(newsheet, session.filename);
          }
          delete session.request.m_code;
          delete session.request.date;
          delete session.request.projects;
          delete session.request.date;
          delete session.request.parent;
        }
        
      }

      res.send("Done");
    });
  }else{
    res.redirect("/");
  }
});


//download
routeExp.route("/download").get(async function (req, res) {
  session = req.session;
  if (session.occupation_a == "admin") {
    res.download(session.filename, function(err){
      fs.unlink(session.filename, function (err) {            
        if (err) {                                                 
            console.error(err);                                    
        }                                                          
       console.log('File has been Deleted');                           
    });         
    });
  }
});
//logout
routeExp.route("/exit_a").get(function (req, res) {
  session = req.session;
  session.occupation_a = null;
  res.redirect("/");
});
routeExp.route("/exit_u").get(function (req, res) {
  session = req.session;
  session.occupation_u = null;
  session.mcode = null;
  session.num_agent;
  res.redirect("/");
});
//Fonction a employer
//Fonction generate excel
function generate_excel(datatowrites) {
  var cumul = 0;
  for (i = 0; i < datatowrites.length; i++) {
    var ligne = [
      datatowrites[i].m_code,
      datatowrites[i].num_agent,
      datatowrites[i].projects,
      datatowrites[i].date,
      datatowrites[i].task,
      datatowrites[i].time_start,
      datatowrites[i].time_end,
    ];
    data.push(ligne);
    calcul_timediff(datatowrites[i].time_start, datatowrites[i].time_end);
    cumul +=  datatowrites[i].amount * timediff(datatowrites[i].time_start, datatowrites[i].time_end);
  }
  totaltime = hours + "H " + minutes + "MN";
  data.push(["", "", "", "", "", "TOTAL", totaltime]);
  data.push([
    "",
    "",
    "",
    "",
    "",
    "AMOUNT",
    cumul.toFixed(2) + " €",
  ]);
  ws = ExcelFile.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    {wpx: 80 },
    {wpx: 130},
    {wpx: 200},
    {wpx: 80},
    {wpx: 500},
    {wpx: 100 },
    {wpx: 100 }
  ];
  const merge = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 6}},
    { s: { r: 3, c: 0 }, e: { r: datatowrites.length + 2, c:0 }},
    { s: { r: 3, c: 1 }, e: { r: datatowrites.length + 2, c:1 }},
  ];
  ws["!merges"] = merge;
  style();
}
function style1(){
  var cellule = ["A", "B", "C"];
  for (c = 0; c < cellule.length; c++) {
    for (i = 1; i <= data.length; i++) {
      if (ws[cellule[c] + "" + i]) {
          if (i == 1) {
          ws[cellule[c] + "" + i].s = {
            fill:{
              patternType : "solid",
              fgColor : { rgb: "619FCB" },
              bgColor: { rgb: "619FCB" },
            },
            font: {
              name: "Segoe UI Black",
              bold: true,
              color: { rgb: "F5F5F5" }
            },
            border: {
              left: { style: "hair" },
              right: { style: "hair" },
              top: {
                style: "hair",
                bottom: { style: "hair" },
              },
            },
            alignment:{
                vertical : "center",
                horizontal:"center"
            },
          };
        } 
        else {
          ws[cellule[c] + "" + i].s = {
            font: {
              name: "Verdana",
              color: {rgb:"777777"}
            },
            border: {
              left: { style: "hair" },
              right: { style: "hair" },
              top: {
                style: "hair",
                bottom: { style: "hair" },
              },
            },
            alignment:{
              vertical : "center",
              horizontal:"center"
          },
          };
        }
      }
    }
  }
}
function style(){
  var cellule = ["A", "B", "C", "D", "E", "F", "G"];
  for (c = 0; c < cellule.length; c++) {
    for (i = 1; i <= data.length; i++) {
      if (ws[cellule[c] + "" + i]) {
        if (i == 1 || i == 2) {
          ws[cellule[c] + "" + i].s = {
            font: {
              name: "Segoe UI Black",
              bold: true,
              color: { rgb: "619FCB" },
            },
            alignment:{
                vertical : "center",
                horizontal:"center"
            },
          };
        }
        else if (i == 3) {
          ws[cellule[c] + "" + i].s = {
            fill:{
              patternType : "solid",
              fgColor : { rgb: "619FCB" },
              bgColor: { rgb: "619FCB" },
            },
            font: {
              name: "Segoe UI Black",
              bold: true,
              color: { rgb: "F5F5F5" }
            },
            border: {
              left: { style: "hair" },
              right: { style: "hair" },
              top: {
                style: "hair",
                bottom: { style: "hair" },
              },
            },
            alignment:{
                vertical : "center",
                horizontal:"center"
            },
          };
        } 
        else {
          ws[cellule[c] + "" + i].s = {
            font: {
              name: "Verdana",
              color: {rgb:"777777"}
            },
            border: {
              left: { style: "hair" },
              right: { style: "hair" },
              top: {
                style: "hair",
                bottom: { style: "hair" },
              },
            },
            alignment:{
              vertical : "center",
              horizontal:"center"
          },
          };
        }
      }
    }
  }
}

//Function Random code for verification
function randomCode() {
  var code = "";
  let v = "012345678";
  for (let i = 0; i < 6; i++) {
    // 6 characters
    let char = v.charAt(Math.random() * v.length - 1);
    code += char;
  }
  return code;
}

//Function random password for new user
function randomPassword() {
  var code = "";
  let v = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!é&#";
  for (let i = 0; i < 8; i++) {
    // 6 characters
    let char = v.charAt(Math.random() * v.length - 1);
    code += char;
  }
  return code;
}


//Function html render
function htmlRender(username, password) {
  var html =
    "<center><h1>Your Timesheets Authentification</h1>" +
    '<table border="1" style="border-collapse:collapse;width:25%;border-color: lightgrey;">' +
    '<thead style="background-color: #619FCB;color:white;font-weight:bold;height: 50px;">' +
    "<tr>" +
    '<td align="center">Username</td>' +
    '<td align="center">Password</td>' +
    "</tr>" +
    "</thead>" +
    '<tbody style="height: 50px;">' +
    "<tr>" +
    '<td align="center">' +
    username +
    "</td>" +
    '<td align="center">' +
    password +
    "</td>" +
    "</tr>" +
    "</tbody>" +
    "</table>";
  return html;
}
function htmlAlert(user, project) {
  var html =
    "<p> Hello,</p>" +
    "<br>" +
    "<p><b>" +
    project +
    "</b></p>" +
    "<p>Employee with M-CODE : <b>" +
    user +
    "</b> logged a time</p>" +
    "<p>Please check it in a timesheets validation page</p>" +
    "<br>" +
    "<p>Regards</p>";
  return html;
}
function calcul_timediff(startTime, endTime) {
  startTime = moment(startTime, "HH:mm:ss a");
  endTime = moment(endTime, "HH:mm:ss a");
  var duration = moment.duration(endTime.diff(startTime));
  //duration in hours
  hours += parseInt(duration.asHours());

  // duration in minutes
  minutes += parseInt(duration.asMinutes()) % 60;
  while (minutes > 60) {
    hours += 1;
    minutes = minutes - 60;
  }
}
function timediff(start,end){
  start = moment(start, "HH:mm:ss a");
  end = moment(end, "HH:mm:ss a");
  var duration = moment.duration(end.diff(start));
  //duration in hours
  var hoursingle = parseInt(duration.asHours());

  // duration in minutes
  var minutesingle = parseInt(duration.asMinutes() % 60);
  return hoursingle + (minutesingle/60);
}
function calcul_euro(euro, hour, minutes) {
  var montanthour = euro * hour;
  var montantminutes = (minutes / 60) * euro;
  var realmontant = montanthour + montantminutes;
  return realmontant;
}
function htmlVerification(code) {
  return (
    "<center><h1>YOUR TIMESHEETS CODE AUTHENTIFICATION</h1>" +
    "<h3 style='width:250px;font-size:50px;padding:8px;background-color:#619FCB; color:white'>" +
    code +
    "<h3></center>"
  );
}
function project_info(searchproject) {
  var amount = 0;
  for (i = 0; i < searchproject.length; i++) {
    calcul_timediff(searchproject[i].time_start, searchproject[i].time_end);
    amount += searchproject[i].amount * timediff(searchproject[i].time_start,searchproject[i].time_end);
  }
  
  var timepassed = hours + " H : " + minutes + " MN";
  hours = 0;
  minutes = 0;
  var all = timepassed + "," + amount.toFixed(2) + " €";
  return all;
}
module.exports = routeExp;
