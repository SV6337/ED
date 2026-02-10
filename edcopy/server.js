const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Replace localhost with the EC2 public IP
const FRONTEND_URL = 'http://65.0.105.4';

// Middleware
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());
// Serve static frontend files
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Serve static files from the HireED directory
app.use('/HireED', express.static(path.join(__dirname, '../HireED')));
// Serve index at root for convenience
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// MongoDB Connection

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});

// ==================== SCHEMAS ====================

// Teacher Schema
const teacherSchema = new mongoose.Schema({
    teacherId: String,
    name: String,
    email: String,
    phone: String,
    password: String,
});

// Student Schema
const studentSchema = new mongoose.Schema({
    studentId: String,
    name: String,
    rollNumber: String,  // Add this line
    email: String,
    phone: String,
    password: String,
    messages: [String],
});

// Course Schema
const courseSchema = new mongoose.Schema({ 
    name: String 
});

// Subject Schema
const subjectSchema = new mongoose.Schema({ 
    name: String, 
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' } 
});

// Class Schema
const classSchema = new mongoose.Schema({ 
    name: String,
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    attendance: [mongoose.Schema.Types.Mixed] // For storing flexible attendance data
}); 

// Resource Schema
const resourceSchema = new mongoose.Schema({
    filename: String,
    path: String,
    category: String,
    size: Number,
    originalName: String,
}, { timestamps: true });

// Attendance Schema
// Updated Attendance Schema
const attendanceSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    studentName: String,
    rollNumber: String,
    className: String,
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    teacherName: String,
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    subjectName: String,
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    courseName: String,
    semester: String,
    status: { type: String, enum: ['present', 'absent'], required: true },
    date: { type: Date, required: true },  // Specific date of attendance
    time: { type: String },  // Time of attendance recording
    recordedAt: { type: Date, default: Date.now }  // When record was created
}, { timestamps: true });


// performance schema

const performanceSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    studentName: { type: String, required: true },
    subject: { type: String, required: true },
    marks: {
      firstInternal: { type: Number, default: 0 },
      secondInternal: { type: Number, default: 0 },
      thirdInternal: { type: Number, default: 0 },
      externalMarks: { type: Number, default: 0 },
      assignmentMarks: { type: Number, default: 0 },
      labInternal: { type: Number, default: 0 },
      labExternal: { type: Number, default: 0 }
    }
  }, { timestamps: true });

// HireED Interview Performance Schema
const interviewPerformanceSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    studentName: { type: String, required: true },
    feature: { type: String, default: 'interview' },
    jobType: { type: String, default: '' },
    score: { type: Number, required: true },
    feedback: { type: String, default: '' },
    question: { type: String, default: '' },
    answer: { type: String, default: '' },
    source: { type: String, default: 'HireED' }
}, { timestamps: true });
  
  


// Event Schema
const eventSchema = new mongoose.Schema({
    title: String,
    description: String,
    announcementDate: { type: Date, default: Date.now },
    commencementDate: Date,
});

// Leave Request Schema
const leaveRequestSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: false },
    studentName: String,
    leaveDate: Date,
    reason: String,
    type: { type: String, enum: ['full-day', 'specific-period'], default: 'full-day' },
    targetTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
    attendancePercentage: { type: Number, default: 100 },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
});

// Task Schema
const taskSchema = new mongoose.Schema({
    taskText: String,
    date: Date,
    time: String,
    duration: String,
    status: { type: String, default: "Pending" },
});



// ==================== MODELS ====================
const Teacher = mongoose.model('Teacher', teacherSchema);
const Student = mongoose.model('Student', studentSchema);
const Course = mongoose.model('Course', courseSchema);
const Subject = mongoose.model('Subject', subjectSchema);
const Class = mongoose.model('Class', classSchema);
const Resource = mongoose.model('Resource', resourceSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Performance = mongoose.model('Performance', performanceSchema);
const InterviewPerformance = mongoose.model('InterviewPerformance', interviewPerformanceSchema);
const Event = mongoose.model('Event', eventSchema);
const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);
const Task = mongoose.model('Task', taskSchema);

// ==================== MULTER CONFIG ====================
// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // ensure destination exists
        const dest = path.join(__dirname, 'uploads');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    },
});

const upload = multer({ storage });

// ==================== ROUTES ====================

// ---------- Authentication Routes ----------
app.post('/login-student', async (req, res) => {
    const { email, password } = req.body;
    try {
      const student = await Student.findOne({ studentId: email });
      if (!student || student.password !== password) {
        return res.status(401).json({ error: 'Invalid student ID or password' });
      }
      res.json({ message: 'Login successful', _id: student._id, name: student.name });
    } catch (err) {
      res.status(500).json({ error: 'Server error during student login' });
    }
  });
  
  app.post('/login-teacher', async (req, res) => {
    const { email, password } = req.body;
    try {
      const teacher = await Teacher.findOne({ teacherId: email });
      if (!teacher || teacher.password !== password) {
        return res.status(401).json({ error: 'Invalid teacher ID or password' });
      }
            // Return both Mongo _id and the human-readable teacherId code
            res.json({ message: 'Login successful', _id: teacher._id, name: teacher.name, teacherId: teacher.teacherId });
    } catch (err) {
      res.status(500).json({ error: 'Server error during teacher login' });
    }
  });

// ===== HireED Interview Performance =====
app.post('/interview-performance', async (req, res) => {
    try {
        const { studentId, score, feedback, question, answer, jobType, studentName, feature } = req.body;
        if (!studentId || score === undefined || score === null) {
            return res.status(400).json({ error: 'studentId and score are required' });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const record = new InterviewPerformance({
            studentId: student._id,
            studentName: studentName || student.name || 'Student',
            feature: feature || 'interview',
            jobType: jobType || '',
            score: Number(score),
            feedback: feedback || '',
            question: question || '',
            answer: answer || ''
        });

        await record.save();
        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Interview performance save error:', error);
        res.status(500).json({ error: 'Failed to save interview performance' });
    }
});

app.get('/interview-performance/teacher/:teacherId', async (req, res) => {
    try {
        const { teacherId } = req.params;
        if (!teacherId) {
            return res.status(400).json({ error: 'teacherId is required' });
        }
        let teacherObjectId = null;
        if (mongoose.Types.ObjectId.isValid(teacherId)) {
            teacherObjectId = teacherId;
        } else {
            const teacherDoc = await Teacher.findOne({ teacherId });
            if (!teacherDoc) {
                return res.json({ items: [], students: [] });
            }
            teacherObjectId = teacherDoc._id;
        }

        const classes = await Class.find({ teacher: teacherObjectId }).populate('students', '_id name studentId');
        const studentIds = new Set();
        const studentMap = new Map();

        classes.forEach(cls => {
            (cls.students || []).forEach(stu => {
                if (stu && stu._id) {
                    const id = String(stu._id);
                    studentIds.add(id);
                    studentMap.set(id, { name: stu.name || 'Student', studentCode: stu.studentId || '' });
                }
            });
        });

        if (studentIds.size === 0) {
            return res.json({ items: [], students: [] });
        }

        const items = await InterviewPerformance.find({
            studentId: { $in: Array.from(studentIds) },
            feature: { $in: ['interview', 'dsa', 'aptitude'] }
        }).sort({ createdAt: -1 });

        const students = Array.from(studentIds).map(id => ({
            id,
            name: studentMap.get(id)?.name || 'Student',
            studentCode: studentMap.get(id)?.studentCode || ''
        }));

        const normalizedItems = items.map(item => ({
            ...item.toObject(),
            feature: item.feature || 'interview'
        }));

        res.json({
            items: normalizedItems,
            students
        });
    } catch (error) {
        console.error('Interview performance fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch interview performance' });
    }
});

  // Seed test teacher data endpoint
  app.post('/seed-test-teacher', async (req, res) => {
    try {
      // Check if test teacher already exists
      const existing = await Teacher.findOne({ teacherId: 'T001' });
      if (existing) {
        return res.json({ message: 'Test teacher already exists', teacher: existing });
      }
      
      // Create test teacher
      const testTeacher = new Teacher({
        teacherId: 'T001',
        name: 'John Smith',
        email: 'john@school.com',
        phone: '+1-234-567-8900',
        password: 'password123'
      });
      
      await testTeacher.save();
      res.json({ message: 'Test teacher created successfully', teacher: testTeacher });
    } catch (error) {
      console.error('Error seeding teacher:', error);
      res.status(500).json({ error: 'Failed to seed test teacher' });
    }
  });

  // Admin Schema
const adminSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'admin' }
});

const Admin = mongoose.model('Admin', adminSchema);

// Admin Registration
app.post('/register-admin', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Check if username or email already exists
        const existingAdmin = await Admin.findOne({ $or: [{ username }, { email }] });
        if (existingAdmin) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        const admin = new Admin({ username, email, password });
        await admin.save();
        
        res.json({ 
            message: 'Admin registered successfully', 
            _id: admin._id 
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to register admin' });
    }
});

// Admin Login
app.post('/login-admin', async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ username });
        if (!admin || admin.password !== password) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        res.json({ 
            message: 'Login successful', 
            _id: admin._id 
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error during admin login' });
    }
});

// Update a student
app.put('/students/:id', async (req, res) => {
  try {
    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedStudent) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.status(200).json(updatedStudent);
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ message: 'Failed to update student' });
  }
});

// Delete a student
app.delete('/students/:id', async (req, res) => {
  try {
    const deletedStudent = await Student.findByIdAndDelete(req.params.id);
    if (!deletedStudent) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.status(200).json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ message: 'Failed to delete student' });
  }
});

// Update a teacher
app.put('/teachers/:id', async (req, res) => {
  try {
    const updatedTeacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedTeacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }
    res.status(200).json(updatedTeacher);
  } catch (error) {
    console.error('Error updating teacher:', error);
    res.status(500).json({ message: 'Failed to update teacher' });
  }
});

// Delete a teacher
app.delete('/teachers/:id', async (req, res) => {
  try {
    const deletedTeacher = await Teacher.findByIdAndDelete(req.params.id);
    if (!deletedTeacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }
    res.status(200).json({ message: 'Teacher deleted successfully' });
  } catch (error) {
    console.error('Error deleting teacher:', error);
    res.status(500).json({ message: 'Failed to delete teacher' });
  }
});


  

// ---------- Teacher/Student Management ----------
app.post('/add-teacher', async (req, res) => {
    try {
        const { teacherId, name, email, phone, password } = req.body;
        const teacher = new Teacher({ teacherId, name, email, phone, password });
        await teacher.save();
        res.status(201).json(teacher);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add teacher' });
    }
});

app.post('/add-student', async (req, res) => {
    try {
        const { studentId, name, email, phone, password } = req.body;
        const student = new Student({ studentId, name, email, phone, password });
        await student.save();
        res.status(201).json(student);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add student' });
    }
});

app.get('/teachers', async (req, res) => {
    try {
        const { studentId } = req.query;
        if (studentId) {
            const classes = await Class.find({ students: new mongoose.Types.ObjectId(studentId) }).populate('teacher');
            const uniqueTeachers = [];
            const seen = new Set();
            classes.forEach(cls => {
                if (cls.teacher && !seen.has(String(cls.teacher._id))) {
                    seen.add(String(cls.teacher._id));
                    uniqueTeachers.push(cls.teacher);
                }
            });
            return res.json(uniqueTeachers);
        }
        const teachers = await Teacher.find();
        return res.json(teachers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch teachers' });
    }
});

// Get a specific teacher by ID
app.get('/teachers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Check if valid ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid teacher ID format' });
        }
        const teacher = await Teacher.findById(id);
        if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
        return res.json(teacher);
    } catch (error) {
        console.error('Error fetching teacher:', error);
        return res.status(500).json({ error: 'Failed to fetch teacher' });
    }
});

// Fallback: fetch teacher by human-readable teacherId code
app.get('/teachers/by-code/:code', async (req, res) => {
    try {
        const { code } = req.params;
        if (!code || typeof code !== 'string') {
            return res.status(400).json({ error: 'Invalid teacher code' });
        }
        const teacher = await Teacher.findOne({ teacherId: code });
        if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
        return res.json(teacher);
    } catch (error) {
        console.error('Error fetching teacher by code:', error);
        return res.status(500).json({ error: 'Failed to fetch teacher by code' });
    }
});

app.get('/students', async (req, res) => {
    try {
        const students = await Student.find();
        res.json(students);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch students' });
    }
});

app.get('/students/:id', async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ error: 'Student not found' });
        res.json(student);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch student' });
    }
});

// ---------- Course/Subject/Class Management ----------
app.post('/add-course', async (req, res) => {
    try {
        const course = new Course({ name: req.body.name });
        await course.save();
        res.status(201).json(course);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add course' });
    }
});

app.post('/add-subject', async (req, res) => {
    try {
        const subject = new Subject({ name: req.body.name, course: req.body.courseId });
        await subject.save();
        res.status(201).json(subject);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add subject' });
    }
});

app.post('/assign-class', async (req, res) => {
    try {
        const { className, teacherId, studentIds, courseId, subjectId } = req.body;
        const classData = new Class({ 
            name: className, 
            teacher: teacherId, 
            students: studentIds, 
            course: courseId, 
            subject: subjectId 
        });
        await classData.save();
        res.status(201).json(classData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to assign class' });
    }
});

app.get('/courses', async (req, res) => {
    try {
        const courses = await Course.find();
        res.json(courses);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

app.get('/subjects', async (req, res) => {
    try {
        const subjects = await Subject.find().populate('course');
        res.json(subjects);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch subjects' });
    }
});

app.get('/classes', async (req, res) => {
    try {
        const { studentId, teacher } = req.query;
        const filter = {};
        if (studentId) filter.students = new mongoose.Types.ObjectId(studentId);
        if (teacher) filter.teacher = new mongoose.Types.ObjectId(teacher);
        const classes = await Class.find(filter)
            .populate('teacher')
            .populate('students')
            .populate('course')
            .populate('subject');
        return res.json(classes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch classes' });
    }
});

// Get classes assigned to a specific teacher
app.get('/teacher-classes/:teacherId', async (req, res) => {
    try {
        const classes = await Class.find({ teacher: req.params.teacherId })
            .populate('teacher')
            .populate('students')
            .populate('course')
            .populate('subject');
        res.json(classes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch teacher classes' });
    }
});

// Update Course
app.put('/courses/:id', async (req, res) => {
    try {
        const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(course);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update course' });
    }
});

// Delete Course
app.delete('/delete-course/:id', async (req, res) => {
    try {
        // Delete all subjects associated with this course
        await Subject.deleteMany({ course: req.params.id });
        // Delete the course
        await Course.findByIdAndDelete(req.params.id);
        res.json({ message: 'Course and associated subjects deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete course' });
    }
});

// Update Subject
app.put('/subjects/:id', async (req, res) => {
    try {
        const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(subject);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update subject' });
    }
});

// Delete Subject
app.delete('/delete-subject/:id', async (req, res) => {
    try {
        await Subject.findByIdAndDelete(req.params.id);
        res.json({ message: 'Subject deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete subject' });
    }
});

// Update Class
app.put('/classes/:id', async (req, res) => {
    try {
        const classData = await Class.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(classData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update class' });
    }
});

// Delete Class
app.delete('/delete-class/:id', async (req, res) => {
    try {
        await Class.findByIdAndDelete(req.params.id);
        res.json({ message: 'Class deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete class' });
    }
});

// Delete Student (alternative route for admin dashboard)
app.delete('/delete-student/:id', async (req, res) => {
    try {
        await Student.findByIdAndDelete(req.params.id);
        res.json({ message: 'Student deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete student' });
    }
});

// Delete Teacher (alternative route for admin dashboard)
app.delete('/delete-teacher/:id', async (req, res) => {
    try {
        await Teacher.findByIdAndDelete(req.params.id);
        res.json({ message: 'Teacher deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete teacher' });
    }
});

// Edit Student (alternative route for admin dashboard)
app.put('/edit-student/:id', async (req, res) => {
    try {
        const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
        return res.json(student);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to update student' });
    }
});

// Edit Subject (alternative route for admin dashboard)
app.put('/edit-subject/:id', async (req, res) => {
    try {
        const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true });
        return res.json(subject);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to update subject' });
    }
});

// ---------- Resource Management ----------
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { category } = req.body;
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { filename, path: filePath, size, originalname } = req.file;

        const newResource = new Resource({
            filename,
            path: path.relative(__dirname, filePath).replace(/\\/g, '/'),
            category,
            size: size || 0,
            originalName: originalname || filename
        });

        await newResource.save();
        res.status(200).json({ message: 'File uploaded successfully!', resource: newResource });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ message: 'Failed to upload file', error: error.message });
    }
});

// GET list of resources
app.get('/resources', async (req, res) => {
    try {
        const resources = await Resource.find().sort({ createdAt: -1 });

        // Normalize output for frontend
        const items = resources.map(r => ({
            _id: r._id,
            filename: r.filename || r.originalName || '',
            path: r.path || '',
            category: r.category || '',
            size: r.size || 0,
            uploadedAt: r.createdAt || r.updatedAt || null
        }));

        res.json(items);
    } catch (err) {
        console.error('Error fetching resources:', err);
        res.status(500).json({ error: 'Failed to fetch resources' });
    }
});

// ---------- Attendance Management ----------
app.post('/submit-attendance', async (req, res) => {
    try {
        const { classId, attendanceData } = req.body;
        await Class.findByIdAndUpdate(classId, { attendance: attendanceData });
        res.json({ message: 'Attendance submitted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to submit attendance' });
    }
});

app.get('/download-attendance', async (req, res) => {
    try {
        const attendances = await Attendance.find();
        const doc = new PDFDocument();
        const filePath = path.join(__dirname, 'attendance_report.pdf');
        doc.pipe(fs.createWriteStream(filePath));

        doc.fontSize(16).text('Attendance Report', { align: 'center' });
        doc.moveDown();

        attendances.forEach((attendance, index) => {
            doc.fontSize(12).text(
                `${index + 1}. ${attendance.studentName} (Roll No: ${attendance.rollNumber}) - ${attendance.status}`

// Add conventional endpoint for updating leave request status
            );
            doc.moveDown();
        });

        doc.end();

        res.download(filePath, 'attendance_report.pdf', (err) => {
            if (err) {
                console.error('Error downloading PDF:', err);
                res.status(500).json({ message: 'Failed to download PDF', error: err.message });
            } else {
                fs.unlinkSync(filePath);
            }
        });
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ message: 'Failed to generate PDF', error: error.message });
    }
});

// In server.js - update the students-with-attendance endpoint
app.get('/students-with-attendance', async (req, res) => {
    try {
        // Fetch all students
        const students = await Student.find({}, 'name rollNumber');

        // Generate attendance stats for each student
        const response = await Promise.all(students.map(async (student) => {
            const records = await Attendance.find({ studentId: student._id });

            const total = records.length;
            const present = records.filter(r => r.status === 'present').length;
            const percentage = total > 0 ? Math.round((present / total) * 100) : 100;

            return {
                _id: student._id,
                name: student.name,
                rollNumber: student.rollNumber,
                attendanceStatus: records[records.length - 1]?.status || 'present',
                attendancePercentage: percentage
            };
        }));

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching students with attendance:', error);
        res.status(500).json({ message: 'Failed to fetch students', error: error.message });
    }
});


// Updated /attendance endpoint
app.post('/attendance', async (req, res) => {
    try {
        const { studentId, studentName, rollNumber, status, date, time, className, teacherId, teacherName, subjectId, subjectName, courseId, courseName, semester } = req.body;
        
        if (!date) {
            return res.status(400).json({ message: 'Date is required' });
        }

        // Create new attendance record with all details
        const newAttendance = new Attendance({
            studentId,
            studentName,
            rollNumber,
            status,
            date: new Date(date),
            time: time || '00:00',
            className: className || 'General',
            teacherId,
            teacherName: teacherName || 'Teacher',
            subjectId,
            subjectName,
            courseId,
            courseName,
            semester: semester || courseName
        });

        await newAttendance.save();
        
        // Calculate attendance percentage for this specific subject
        const attendanceStats = await Attendance.aggregate([
            {
                $match: { 
                    studentId: new mongoose.Types.ObjectId(studentId),
                    subjectId: subjectId ? new mongoose.Types.ObjectId(subjectId) : { $exists: true }
                }
            },
            {
                $group: {
                    _id: "$studentId",
                    presentCount: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "present"] }, 1, 0]
                        }
                    },
                    totalCount: { $sum: 1 }
                }
            }
        ]);

        const percentage = attendanceStats.length > 0 
            ? Math.round((attendanceStats[0].presentCount / attendanceStats[0].totalCount) * 100)
            : 100;

        res.status(200).json({ 
            message: 'Attendance updated successfully!',
            attendancePercentage: percentage
        });
    } catch (error) {
        console.error('Error updating attendance:', error);
        res.status(500).json({ message: 'Failed to update attendance', error: error.message });
    }
});

// Updated bulk attendance endpoint
app.post('/attendance-bulk', async (req, res) => {
    try {
        const attendances = req.body;
        const date = req.body.date || new Date();

        const updates = await Promise.all(attendances.map(async ({ studentId, studentName, rollNumber, status }) => {
            const newAttendance = new Attendance({
                studentId,
                studentName,
                rollNumber,
                status,
                date: new Date(date),
                time: req.body.time || '00:00',
                className: req.body.className || 'General',
                teacherName: req.body.teacherName || 'Teacher'
            });

            await newAttendance.save();

            const stats = await Attendance.aggregate([
                { $match: { studentId: new mongoose.Types.ObjectId(studentId) } },
                {
                    $group: {
                        _id: "$studentId",
                        presentCount: {
                            $sum: {
                                $cond: [{ $eq: ["$status", "present"] }, 1, 0]
                            }
                        },
                        totalCount: { $sum: 1 }
                    }
                }
            ]);

            const percentage = stats.length > 0
                ? Math.round((stats[0].presentCount / stats[0].totalCount) * 100)
                : 100;

            return { studentId, percentage };
        }));

        res.json({ message: 'Bulk attendance updated', updates });
    } catch (error) {
        console.error('Bulk attendance error:', error);
        res.status(500).json({ message: 'Failed to update attendance', error: error.message });
    }
});

app.get('/attendance/export/excel', async (req, res) => {
    try {
        const { date } = req.query;
        let query = {};
        
        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            query.date = { $gte: startDate, $lte: endDate };
        }

        const attendances = await Attendance.find(query).populate('studentId', 'name rollNumber');
        const data = attendances.map(a => ({
            Name: a.studentId?.name || a.studentName || 'Unknown',
            RollNumber: a.studentId?.rollNumber || a.rollNumber || 'N/A',
            Status: a.status,
            Date: a.date.toLocaleDateString(),
            Time: a.time || 'N/A',
            Class: a.className || 'General',
            Teacher: a.teacherName || 'Teacher'
        }));

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Attendance');
        
        // Add headers
        worksheet.columns = [
            { header: 'Name', key: 'Name', width: 20 },
            { header: 'Status', key: 'Status', width: 15 },
            { header: 'Date', key: 'Date', width: 15 },
            { header: 'Time', key: 'Time', width: 15 },
            { header: 'Class', key: 'Class', width: 20 },
            { header: 'Teacher', key: 'Teacher', width: 20 }
        ];
        
        // Add rows
        worksheet.addRows(data);

        const buffer = await workbook.xlsx.writeBuffer();

        const filename = date ? 
            `attendance_report_${date.replace(/-/g, '')}.xlsx` : 
            'attendance_report_all.xlsx';

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error('Excel export error:', error);
        res.status(500).json({ error: 'Failed to export Excel file' });
    }
});


// Get attendance by date
app.get('/attendance-by-date', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ error: 'Date parameter is required' });
        }

        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        const attendance = await Attendance.find({
            date: { $gte: startDate, $lte: endDate }
        }).populate('studentId', 'name rollNumber');

        res.json(attendance);
    } catch (error) {
        console.error('Error fetching attendance by date:', error);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});



// ---------- Performance Management ----------
app.get('/subjects/teacher/:teacherId', async (req, res) => {
    try {
        const { teacherId } = req.params;
        // Find classes taught by this teacher
        const classes = await Class.find({ teacher: teacherId }).populate('subject');
        // Extract unique subjects
        const subjects = [...new Set(classes.map(c => c.subject))];
        res.json(subjects);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch subjects' });
    }
});

app.get('/students/subject/:subjectId', async (req, res) => {
    try {
        const { subjectId } = req.params;
        // Find classes for this subject
        const classes = await Class.find({ subject: subjectId }).populate('students');
        // Extract and combine students from all classes
        const students = classes.flatMap(c => c.students);
        res.json(students);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch students' });
    }
});
app.get('/performance/:studentId', async (req, res) => {
    const { studentId } = req.params;
    const { page = 1, limit = 10 } = req.query;
  
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }
  
    try {
      const records = await Performance.find({ studentId })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
      res.status(200).json(records);
    } catch (err) {
      console.error('Error fetching performance:', err);
      res.status(500).json({ error: 'Failed to fetch performance' });
    }
  });
  

  app.get('/performance/:studentId/:subject', async (req, res) => {
    const { studentId, subject } = req.params;
  
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }
  
    try {
      const record = await Performance.findOne({ studentId, subject });
  
      if (!record) {
        return res.status(404).json({ message: 'No performance record found for this subject' });
      }
  
      res.status(200).json(record);
    } catch (err) {
      console.error('Error fetching subject performance:', err);
      res.status(500).json({ error: 'Failed to fetch subject performance' });
    }
  });



  app.delete('/performance/:studentId/:subject', async (req, res) => {
    const { studentId, subject } = req.params;
  
    // Validate studentId format
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }
  
    try {
      // Delete the performance record
      const result = await Performance.deleteOne({ studentId, subject });
  
      if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'No performance record found to delete' });
      }
  
      res.status(200).json({ message: 'Performance record deleted successfully' });
    } catch (err) {
      console.error('Error deleting performance record:', err);
      res.status(500).json({ error: 'Failed to delete performance record' });
    }
  });
  
  
  app.post('/performance', async (req, res) => {
    const { studentId, subject, marks } = req.body;
  
    if (!studentId || !subject || !marks) {
      return res.status(400).json({ error: 'Missing studentId, subject, or marks' });
    }
  
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }
  
    try {
      const student = await Student.findById(studentId);
      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }
  
      let record = await Performance.findOne({ studentId, subject });
  
      if (record) {
        record.marks = marks;
        record.studentName = student.name;
      } else {
        record = new Performance({
          studentId,
          studentName: student.name,
          subject,
          marks,
        });
      }
  
      await record.save();
      res.status(200).json({ message: 'Performance saved successfully', performance: record });
    } catch (err) {
      console.error('Error saving performance:', err);
      res.status(500).json({ error: 'Failed to save performance' });
    }
  });
  
  
  

// ---------- Event Management ----------
app.get('/events', async (req, res) => {
    try {
        const events = await Event.find();
        res.status(200).json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Failed to fetch events', error: error.message });
    }
});

// Update the /events POST endpoint to notify students
app.post('/events', async (req, res) => {
    try {
        const { title, description, commencementDate, teacherId } = req.body;

        if (!teacherId || !mongoose.Types.ObjectId.isValid(teacherId)) {
            return res.status(400).json({ message: 'Valid teacher ID is required' });
        }

        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        const newEvent = new Event({
            title,
            description,
            commencementDate: new Date(commencementDate),
        });

        await newEvent.save();

        // Notify all students about the new event
        const message = `New Event by ${teacher.name}: ${title} is scheduled on ${new Date(commencementDate).toLocaleDateString()}.`;
        await Student.updateMany({}, { $push: { messages: message } });

        res.status(200).json({ message: 'Event added successfully!', event: newEvent });
    } catch (error) {
        console.error('Error adding event:', error);
        res.status(500).json({ message: 'Failed to add event', error: error.message });
    }
});

app.delete('/events/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Event.findByIdAndDelete(id);
        res.status(200).json({ message: 'Event deleted successfully!' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ message: 'Failed to delete event', error: error.message });
    }
});

// ---------- Leave Request Management ----------
// Update the leave request schema to include studentId

// Update the leave request POST endpoint
app.post('/leave-requests', async (req, res) => {
    try {
        const { studentId, studentName, leaveDate, reason, type, targetTeacherId } = req.body;

        // Calculate attendance percentage
        const attendanceStats = await Attendance.aggregate([
            { $match: { studentId: new mongoose.Types.ObjectId(studentId) } },
            {
                $group: {
                    _id: "$studentId",
                    presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
                    totalCount: { $sum: 1 }
                }
            }
        ]);

        const percentage = attendanceStats.length > 0 
            ? Math.round((attendanceStats[0].presentCount / attendanceStats[0].totalCount) * 100)
            : 100;

        const newLeaveRequest = new LeaveRequest({
            studentId,
            studentName,
            leaveDate: new Date(leaveDate),
            reason,
            type: type === 'specific-period' ? 'specific-period' : 'full-day',
            targetTeacherId: type === 'specific-period' && targetTeacherId && mongoose.Types.ObjectId.isValid(targetTeacherId)
                ? new mongoose.Types.ObjectId(targetTeacherId)
                : null,
            attendancePercentage: percentage
        });

        await newLeaveRequest.save();
        res.status(200).json({ 
            message: 'Leave request submitted successfully!', 
            leaveRequest: newLeaveRequest 
        });
    } catch (error) {
        console.error('Error submitting leave request:', error);
        res.status(500).json({ 
            message: 'Failed to submit leave request', 
            error: error.message 
        });
    }
});

      app.post('/update-leave-status', async (req, res) => {
    try {
        const { requestId, status } = req.body;

        // Find the leave request by ID
        const leaveRequest = await LeaveRequest.findByIdAndUpdate(
            requestId,
            { status },
            { new: true }
        );

        if (!leaveRequest) {
            return res.status(404).json({ message: 'Leave request not found' });
        }

        // Create a notification message for the student
        const message = `Your leave request for ${new Date(leaveRequest.leaveDate).toLocaleDateString()} has been ${status.toLowerCase()}.`;

        // Find the student by name and add the message
        await Student.findOneAndUpdate(
            { name: leaveRequest.studentName },
            { $push: { messages: message } }
        );

        res.status(200).json({
            message: 'Leave request updated successfully!',
            leaveRequest
        });
    } catch (error) {
        console.error('Error updating leave request:', error);
        res.status(500).json({ message: 'Failed to update leave request', error: error.message });
    }
});

// Add this endpoint to server.js
app.get('/leave-requests', async (req, res) => {
    try {
        const { students, teacherId } = req.query;

        const query = {};
        if (students) {
            const studentIds = students.split(',').filter(Boolean).map(id => new mongoose.Types.ObjectId(id));
            if (studentIds.length > 0) {
                query.studentId = { $in: studentIds };
            }
        }

        // If a teacherId is provided, only return
        // - full-day requests for their students
        // - specific-period requests targeted to that teacher
        let filter = {};
        if (teacherId && mongoose.Types.ObjectId.isValid(teacherId)) {
            filter = {
                $or: [
                    { type: 'full-day' },
                    { type: 'specific-period', targetTeacherId: new mongoose.Types.ObjectId(teacherId) }
                ]
            };
        }

        const finalQuery = Object.keys(filter).length > 0 ? { $and: [query, filter] } : query;

        const leaveRequests = await LeaveRequest.find(finalQuery)
            .sort({ leaveDate: 1 })
            .populate('studentId', 'name rollNumber');

        res.status(200).json(leaveRequests);
    } catch (error) {
        console.error('Error fetching leave requests:', error);
        res.status(500).json({ 
            message: 'Failed to fetch leave requests', 
            error: error.message 
        });
    }
});

// Conventional: update leave status via PUT
app.put('/leave-requests/:id', async (req, res) => {
    try {
        console.log('PUT /leave-requests/:id - Received payload:', { id, status });
        console.log('Received PUT request to update leave request:', req.body);
        const { id } = req.params;
        const { status } = req.body;

        if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
            console.error('Invalid status value:', status);
            return res.status(400).json({ message: 'Invalid status value' });
        }

        const leaveRequest = await LeaveRequest.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!leaveRequest) {
            console.error('Leave request not found for ID:', id);
            return res.status(404).json({ message: 'Leave request not found' });
        }

        console.log('Leave request updated successfully:', leaveRequest);

        // Create message for student
        const msgDate = leaveRequest.leaveDate ? new Date(leaveRequest.leaveDate).toLocaleDateString() : 'the selected date';
        const message = `Your leave request for ${msgDate} has been ${status.toLowerCase()}.`;

        if (leaveRequest.studentId) {
            await Student.findByIdAndUpdate(leaveRequest.studentId, { $push: { messages: message } });
        }

        res.status(200).json({ message: 'Leave request updated successfully', leaveRequest });
    } catch (error) {
        console.error('Error updating leave request:', error);
        res.status(500).json({ message: 'Failed to update leave request', error: error.message });
    }
});




// ---------- Task Management ----------
app.get('/tasks', async (req, res) => {
    try {
        const tasks = await Task.find();
        res.status(200).json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Failed to fetch tasks', error: error.message });
    }
});

app.post('/tasks', async (req, res) => {
    try {
        const { taskText, date, time, duration } = req.body;

        const newTask = new Task({
            taskText,
            date: new Date(date),
            time,
            duration,
        });

        await newTask.save();
        res.status(200).json({ message: 'Task added successfully!', task: newTask });
    } catch (error) {
        console.error('Error adding task:', error);
        res.status(500).json({ message: 'Failed to add task', error: error.message });
    }
});

app.put('/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const updatedTask = await Task.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!updatedTask) {
            return res.status(404).json({ message: 'Task not found' });
        }

        res.status(200).json({ message: 'Task updated successfully!', task: updatedTask });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ message: 'Failed to update task', error: error.message });
    }
});

app.delete('/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Task.findByIdAndDelete(id);
        res.status(200).json({ message: 'Task deleted successfully!' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Failed to delete task', error: error.message });
    }
});

// ---------- Message Management ----------
app.post('/send-message', async (req, res) => {
    try {
        const { studentId, content } = req.body;
        await Student.findByIdAndUpdate(studentId, { $push: { messages: content } });
        res.json({ message: 'Message sent successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Clear messages for a student
app.post('/clear-messages', async (req, res) => {
    try {
        const { studentId } = req.body;
        if (!studentId) return res.status(400).json({ error: 'studentId required' });
        await Student.findByIdAndUpdate(studentId, { $set: { messages: [] } });
        res.json({ message: 'Messages cleared' });
    } catch (error) {
        console.error('Error clearing messages:', error);
        res.status(500).json({ error: 'Failed to clear messages' });
    }
});

// ---------- Dashboard ----------
app.get('/api/dashboard/:teacherId', async (req, res) => {
    try {
        const teacherId = req.params.teacherId;
        
        // Validate teacherId format
        if (!mongoose.Types.ObjectId.isValid(teacherId)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid teacher ID format' 
            });
        }

        // Check teacher exists
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            return res.status(404).json({ 
                success: false,
                message: 'Teacher not found' 
            });
        }

        // Get all counts with individual error handling
        let totalCourses, totalStudents, upcomingEvents, pendingLeaves;
        
        try {
            totalCourses = await Course.countDocuments();
        } catch (err) {
            console.error('Error counting courses:', err);
            totalCourses = 0;
        }

        try {
            totalStudents = await Student.countDocuments();
        } catch (err) {
            console.error('Error counting students:', err);
            totalStudents = 0;
        }

        try {
            upcomingEvents = await Event.countDocuments({ 
                commencementDate: { $gte: new Date() } 
            });
        } catch (err) {
            console.error('Error counting events:', err);
            upcomingEvents = 0;
        }

        try {
            pendingLeaves = await LeaveRequest.countDocuments({ 
                status: 'Pending' 
            });
        } catch (err) {
            console.error('Error counting leave requests:', err);
            pendingLeaves = 0;
        }

        res.status(200).json({
            success: true,
            data: {
                name: teacher.name,
                totalCourses,
                totalStudents,
                upcomingEvents,
                pendingLeaves,
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch dashboard data',
            error: error.message 
        });
    }
});

// Consolidated import-students endpoint defined below

app.post('/import-students', async (req, res) => {
    try {
        const { students } = req.body;
        
        // Validate request structure
        if (!Array.isArray(students)) {
            return res.status(400).json({ error: 'Invalid data format' });
        }

        // Validate each student
        const validationErrors = [];
        students.forEach((student, index) => {
            if (!student.studentId) {
                validationErrors.push(`Row ${index+1}: Missing Student ID`);
            }
            if (!student.name) {
                validationErrors.push(`Row ${index+1}: Missing Name`);
            }
            if (!student.email) {
                validationErrors.push(`Row ${index+1}: Missing Email`);
            }
            // Password defaults to "password123" if empty
            if (!student.password) {
                student.password = 'password123';
            }
        });

        if (validationErrors.length > 0) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: validationErrors
            });
        }

        // Insert students
        const result = await Student.insertMany(students);
        res.json({ 
            success: true,
            imported: result.length
        });
        
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ 
            error: 'Import failed',
            details: error.message
        });
    }
});

// Student Attendance Endpoint
app.get('/attendance/student', async (req, res) => {
    console.log('=== STARTING ATTENDANCE REQUEST ===');
    console.log('Query params:', req.query);

    try {
        const { studentId } = req.query;
        console.log('Received studentId:', studentId);

        if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
            console.log('Invalid or missing studentId');
            return res.status(400).json({ error: 'Valid Student ID required' });
        }

        console.log('Querying database...');
        const records = await Attendance.find({ studentId }).lean();
        console.log(`Found ${records.length} records`);

        const response = records.map(r => ({
            date: r.date,
            status: r.status,
            className: r.className || 'General',
            teacherName: r.teacherName || 'Not specified'
        }));

        console.log('Sending response:', response);
        res.json(response);

    } catch (error) {
        console.error('ATTENDANCE ERROR:', error);
        res.status(500).json({ error: error.message });
    }
});
// Add this with your other route definitions
app.get('/api/attendance/student', async (req, res) => {
    try {
        const { studentId } = req.query;
        
        if (!studentId) {
            return res.status(400).json({ error: 'Student ID is required' });
        }

        // Find attendance records for this student grouped by subject
        const attendance = await Attendance.aggregate([
            { $match: { studentId: new mongoose.Types.ObjectId(studentId) } },
            {
                $group: {
                    _id: "$subjectId",
                    subjectName: { $first: "$subjectName" },
                    courseName: { $first: "$courseName" },
                    records: { $push: "$$ROOT" },
                    totalClasses: { $sum: 1 },
                    presentClasses: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "present"] }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    subjectName: 1,
                    courseName: 1,
                    totalClasses: 1,
                    presentClasses: 1,
                    percentage: {
                        $multiply: [
                            { $divide: ["$presentClasses", "$totalClasses"] },
                            100
                        ]
                    },
                    records: {
                        $map: {
                            input: "$records",
                            as: "record",
                            in: {
                                date: "$$record.date",
                                status: "$$record.status",
                                className: "$$record.className",
                                teacherName: "$$record.teacherName"
                            }
                        }
                    }
                }
            },
            { $sort: { subjectName: 1 } }
        ]);

        res.json(attendance);

    } catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({ error: 'Failed to fetch attendance records' });
    }
});

// Get attendance for specific student and subject
app.get('/attendance/student/:studentId/subject/:subjectId', async (req, res) => {
    try {
        const { studentId, subjectId } = req.params;
        
        const records = await Attendance.find({ 
            studentId: new mongoose.Types.ObjectId(studentId),
            subjectId: new mongoose.Types.ObjectId(subjectId)
        }).sort({ date: -1 });

        const total = records.length;
        const present = records.filter(r => r.status === 'present').length;
        const lastStatus = records.length > 0 ? records[0].status : 'present';

        res.json({
            total,
            present,
            absent: total - present,
            percentage: total > 0 ? Math.round((present / total) * 100) : 0,
            lastStatus,
            records: records.slice(0, 10) // Last 10 records
        });

    } catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});

// In server.js temporary route
app.post('/test-data', async (req, res) => {
    await new Attendance({
        studentId: '67f26974de6223478a4b7c71',
        status: 'present',
        className: 'Mathematics',
        teacherName: 'Dr. Smith',
        date: new Date()
    }).save();
    res.send('Test record added');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


