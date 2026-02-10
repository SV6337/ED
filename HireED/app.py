from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq
import os
from dotenv import load_dotenv
import random
import ast
import json # <--- ADDED IMPORT
from textwrap import dedent
from datetime import datetime
from pymongo import MongoClient

# Load environment variables
load_dotenv()

# Fetch MongoDB URI from .env
MONGO_URI = os.getenv("MONGO_URI")

# Debugging: Print the loaded MongoDB URI
print(f"Loaded MONGO_URI: {MONGO_URI}")

# Initialize MongoDB Atlas connection
mongo_client = MongoClient(MONGO_URI) if MONGO_URI else None

# Ensure the app serves static files correctly
app = Flask(__name__, static_folder='HireED', static_url_path='/')
CORS(app)  # Enable CORS for all routes

# Enable CORS for the Flask app
CORS(app, resources={r"/*": {"origins": "*"}})
CORS(app, resources={r"/*": {"origins": "http://65.0.105.4:5000"}})

# ---------------- MongoDB Atlas (Chat Logs) ----------------
# MongoDB Atlas connection
mongo_client = None
chat_collection = None
mongo_error_message = ""
mongo_connected_uri = ""

def init_mongo_connection():
    global mongo_client, chat_collection, mongo_error_message, mongo_connected_uri

    mongo_candidates = []
    if MONGO_URI and MONGO_URI not in mongo_candidates:
        mongo_candidates.append(MONGO_URI)
    mongo_candidates.append("mongodb://localhost:27017/edvantage")

    for uri in mongo_candidates:
        try:
            client = MongoClient(uri, serverSelectionTimeoutMS=3000)
            client.admin.command('ping')
            mongo_db = client.get_default_database()
            if mongo_db is None:
                mongo_db = client["hireed"]
            chat_collection = mongo_db["student_chats"]
            mongo_client = client
            mongo_error_message = ""
            mongo_connected_uri = uri
            print(f"MongoDB connected: {uri}")
            return chat_collection
        except Exception as e:
            mongo_error_message = str(e)

    chat_collection = None
    mongo_client = None
    mongo_connected_uri = ""
    print(f"MongoDB connection error: {mongo_error_message}")
    return None


init_mongo_connection()


@app.route('/mongo-status', methods=['GET'])
def mongo_status():
    return jsonify({
        'connected': chat_collection is not None,
        'error': mongo_error_message,
        'uri': mongo_connected_uri or None
    })

# Initialize Groq client
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ---------------- Structured Prompts (CRITICAL FIX) ----------------
INTERVIEW_PROMPT = """
Act as an interviewer for a {job_type} interview. Your job is to ask interview questions one by one and evaluate the candidate's answers.

Follow these rules:
1. Ask questions related to the job type. Ask only one question at a time.
2. For every response, first, provide constructive feedback and a score (out of 10) for the candidate's answer, including suggestions and a better answer. This is the **Feedback**.
3. Then, ask the **Next Question** based on the conversation so far.
4. **CRITICAL**: Respond with a single JSON object containing two top-level keys: "feedback" (containing all evaluation/score/suggestions) and "next_question" (containing the next question text).

Example JSON format for a regular turn:
{{
  "feedback": "That was a strong answer. Score: 9/10. Suggestion: You could mention how you'd use a specific tool...",
  "next_question": "Moving on to technical skills, how do you handle concurrency in Python?"
}}

Example JSON format for the very first question (after the welcome):
{{
  "feedback": "Welcome to your mock interview for the {job_type} position. Let's start with a warm-up.",
  "next_question": "Can you start by telling me a little bit about yourself and your background?"
}}
"""

RESUME_PROMPT = """
You are a professional resume builder. Create a well-structured resume for a {job_type} position based on the following information:
Name: {name}, Email: {email}, Phone: {phone}, Skills: {skills}, Experience: {experience} years.
Generate the resume text using professional headings like CONTACT, SUMMARY, SKILLS, EXPERIENCE, EDUCATION.
"""

# Coding & Debugging challenge templates (unchanged)
CODING_TEMPLATES = {
    "python": {
        "easy": ["Reverse a {data_structure}", "Check if {condition}"],
        "medium": ["Implement {algorithm}", "Find {pattern} in {data_structure}"],
        "hard": ["Optimize {algorithm} for {constraint}", "Design {system}"]
    },
    "javascript": {
        "easy": ["{operation} an array", "Validate {structure}"],
        "medium": ["Implement {concept} using {method}", "Async {task}"],
        "hard": ["Build {feature} with {constraints}", "Debug {complex_scenario}"]
    }
}

DEBUGGING_CHALLENGES = {
    "python": {
        "easy": [
            {
                "buggy_code": dedent("""
                def add(a, b):
                    return a * b  # Wrong operator
                """),
                "test_cases": [(2, 3), (0, 5)],
                "hint": "Check the arithmetic operator"
            }
        ],
        "medium": [
            {
                "buggy_code": dedent("""
                def factorial(n):
                    if n == 0:
                        return 0  # Base case error
                    return n * factorial(n-1)
                """),
                "test_cases": [(5,), (0,)],
                "hint": "The base case return value is incorrect"
            }
        ],
        "hard": [
            {
                "buggy_code": dedent("""
                def binary_search(arr, target):
                    low, high = 0, len(arr)
                    while low < high:
                        mid = (low + high) // 2
                        if arr[mid] == target:
                            return mid
                        elif arr[mid] < target:
                            low = mid + 1
                        else:
                            high = mid  # Off-by-one error
                    return -1
                """),
                "test_cases": [([1, 3, 5, 7], 5), ([], 1)],
                "hint": "Check boundary conditions carefully"
            }
        ]
    }
}

def sanitize_conversation_history(history):
    if not isinstance(history, list):
        return []
    return [msg for msg in history
            if isinstance(msg, dict)
            and msg.get('role') in ['user', 'assistant', 'system']
            and isinstance(msg.get('content'), str)]


@app.route('/log-chat', methods=['POST'])
def log_chat():
    if chat_collection is None:
        init_mongo_connection()
    if chat_collection is None:
        return jsonify({'error': f'MongoDB connection not available: {mongo_error_message}'}), 500
    try:
        data = request.get_json() or {}
        student_id = (data.get('studentId') or 'anonymous').strip()
        student_name = (data.get('studentName') or '').strip()
        feature = (data.get('feature') or 'unknown').strip()
        role = (data.get('role') or 'system').strip()
        message = data.get('message') or ''
        message_text = data.get('message_text') or ''
        session_id = data.get('sessionId') or ''
        metadata = data.get('metadata') or {}

        if not message:
            return jsonify({'error': 'Message is required'}), 400

        chat_collection.insert_one({
            'studentId': student_id,
            'studentName': student_name,
            'feature': feature,
            'role': role,
            'message': message,
            'message_text': message_text,
            'sessionId': session_id,
            'metadata': metadata,
            'createdAt': datetime.utcnow()
        })

        return jsonify({'status': 'ok'})
    except Exception as e:
        print(f"log-chat error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/chat-history', methods=['GET'])
def chat_history():
    if chat_collection is None:
        init_mongo_connection()
    if chat_collection is None:
        return jsonify({'error': f'MongoDB connection not available: {mongo_error_message}'}), 500
    try:
        student_id = (request.args.get('studentId') or '').strip()
        if not student_id:
            return jsonify({'error': 'studentId is required'}), 400
        feature = (request.args.get('feature') or '').strip()
        limit_raw = request.args.get('limit', '200')
        try:
            limit = max(1, min(int(limit_raw), 1000))
        except ValueError:
            limit = 200

        query = {'studentId': student_id}
        if feature:
            query['feature'] = feature

        cursor = chat_collection.find(query).sort('createdAt', -1).limit(limit)
        items = []
        for doc in cursor:
            created_at = doc.get('createdAt')
            items.append({
                'id': str(doc.get('_id')),
                'studentId': doc.get('studentId'),
                'studentName': doc.get('studentName', ''),
                'feature': doc.get('feature', ''),
                'role': doc.get('role', ''),
                'message': doc.get('message', ''),
                'message_text': doc.get('message_text', ''),
                'sessionId': doc.get('sessionId', ''),
                'metadata': doc.get('metadata', {}),
                'createdAt': created_at.isoformat() + 'Z' if isinstance(created_at, datetime) else None
            })

        items.reverse()
        return jsonify({'items': items})
    except Exception as e:
        print(f"chat-history error: {e}")
        return jsonify({'error': str(e)}), 500

# ---------------- Routes ----------------
@app.route('/start-interview', methods=['POST'])
def start_interview():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data received'}), 400
        job_type = data.get('job_type', '').strip()
        if not job_type:
            return jsonify({'error': 'Job type is required'}), 400

        # Initial prompt to get the first structured question
        conversation_history = [
            {"role": "system", "content": INTERVIEW_PROMPT.format(job_type=job_type)},
            {"role": "user", "content": f"The interview is for a {job_type} position. Please ask the first question now."}
        ]

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=conversation_history,
            temperature=0.7,
            max_tokens=1024,
            # CRITICAL FIX: Enforce JSON response format
            response_format={"type": "json_object"} 
        )
        
        ai_json_string = response.choices[0].message.content.strip()
        
        # CRITICAL FIX: Safely parse the JSON string from the AI
        try:
            ai_data = json.loads(ai_json_string)
            feedback = ai_data.get('feedback', 'Welcome to your mock interview!')
            next_question = ai_data.get('next_question', 'What is your greatest strength?')
        except json.JSONDecodeError:
            # Fallback if AI fails to return valid JSON
            feedback = "Starting interview. Could not parse the AI's structured response. Here is the raw question:"
            next_question = ai_json_string
            ai_data = {'feedback': feedback, 'next_question': next_question}

        # Add the AI's structured response (as a string) to the history
        conversation_history.append({"role": "assistant", "content": json.dumps(ai_data)})
        
        # FIX: Return the structured response expected by script.js
        return jsonify({
            'feedback': feedback,
            'next_question': next_question,
            'conversation_history': conversation_history
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/interview-chatbot', methods=['POST'])
def handle_interview_chat():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data received'}), 400
        job_type = data.get('job_type', '').strip()
        conversation_history = data.get('conversation_history', [])
        user_message = data.get('user_message', '').strip()
        if not job_type:
            return jsonify({'error': 'Job type is required'}), 400
        if not user_message:
            return jsonify({'error': 'User message is required'}), 400

        conversation_history = sanitize_conversation_history(conversation_history)
        # Ensure the latest user message is added if it's not already there
        if not conversation_history or conversation_history[-1].get('content') != user_message:
             conversation_history.append({"role": "user", "content": user_message})

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=conversation_history,
            temperature=0.7,
            max_tokens=1024,
            # CRITICAL FIX: Enforce JSON response format
            response_format={"type": "json_object"} 
        )
        
        ai_json_string = response.choices[0].message.content.strip()
        
        # CRITICAL FIX: Safely parse the JSON string from the AI
        try:
            ai_data = json.loads(ai_json_string)
            feedback = ai_data.get('feedback', 'No feedback provided.')
            next_question = ai_data.get('next_question', 'Please continue with the next question.')
        except json.JSONDecodeError:
            # Fallback for unexpected AI response (raw text)
            feedback = "Error processing structured response. Here is the raw output:"
            next_question = ai_json_string 
            ai_data = {'feedback': feedback, 'next_question': next_question}

        # Add the AI's full structured response (as a string) to the history
        conversation_history.append({"role": "assistant", "content": json.dumps(ai_data)})
        
        # FIX: Return the structured response expected by script.js
        return jsonify({
            'feedback': feedback,
            'next_question': next_question,
            'conversation_history': conversation_history
        })
    except Exception as e:
        # This will now catch true server errors
        return jsonify({'error': str(e)}), 500


@app.route('/generate-resume', methods=['POST'])
def generate_resume():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data received'}), 400
        job_type = data.get('job_type', '').strip()
        skills = data.get('skills', '').strip()
        experience = data.get('experience', '0').strip()
        name = data.get('name', '').strip()
        email = data.get('email', '').strip()
        phone = data.get('phone', '').strip()
        if not job_type or not skills:
            return jsonify({'error': 'Job type and skills are required'}), 400

        prompt = RESUME_PROMPT.format(
            job_type=job_type,
            skills=skills,
            experience=experience,
            name=name,
            email=email,
            phone=phone
        )
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=1024
        )
        ai_response = response.choices[0].message.content.strip()
        return jsonify({'resume': ai_response})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/start-coding-challenge', methods=['POST'])
def start_coding_challenge():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data received'}), 400
        language = data.get('language', 'python')
        difficulty = data.get('difficulty', 'easy')

        prompt = f"""
        Generate a {difficulty}-level {language} coding question with:
        1. A clear problem statement
        2. 2 test cases with inputs and expected outputs
        3. The correct solution
        Format as JSON with keys: question, test_cases, solution
        """
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        try:
            # Use json.loads instead of eval for safer parsing
            question_data = json.loads(response.choices[0].message.content)
            return jsonify({'question': question_data})
        except:
            return jsonify({
                'question': {
                    'question': f"Write a {language} function to...",
                    'test_cases': [(["input1"], "output1"), (["input2"], "output2")],
                    'solution': "def solution():\n    return 42"
                }
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/evaluate-code', methods=['POST'])
def evaluate_code():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data received'}), 400
        language = data.get('language', 'python')
        code = data.get('code', '')
        test_cases = data.get('test_cases', [])
        if not code or not test_cases:
            return jsonify({'error': 'Code and test cases are required'}), 400

        if language == "python":
            namespace = {}
            exec(code, namespace)
            if 'solution' not in namespace:
                return jsonify({'passed': False, 'message': "Your code must define a 'solution' function"})
            failed_cases = []
            for test_input, expected in test_cases:
                try:
                    # Handle cases where test_input might be a single item or a list
                    if isinstance(test_input, list) or isinstance(test_input, tuple):
                        result = namespace['solution'](*test_input)
                    else:
                        result = namespace['solution'](test_input)

                    if result != expected:
                        failed_cases.append({'input': test_input, 'expected': expected, 'actual': result})
                except Exception as e:
                    failed_cases.append({'input': test_input, 'error': str(e)})
            if not failed_cases:
                return jsonify({'passed': True})
            return jsonify({'passed': False,
                            'message': f"Failed {len(failed_cases)}/{len(test_cases)} test cases",
                            'failed_cases': failed_cases})
        else:
            return jsonify({'passed': False, 'message': "Only Python execution is currently supported"})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/start-debugging-challenge', methods=['POST'])
def start_debugging_challenge():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data received'}), 400
        difficulty = data.get('difficulty', 'easy')
        challenge = random.choice(DEBUGGING_CHALLENGES['python'][difficulty])
        return jsonify({'challenge': challenge})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/evaluate-debug-fix', methods=['POST'])
def evaluate_debug_fix():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data received'}), 400
        original_code = data.get('original_code', '')
        user_fix = data.get('user_fix', '')
        test_cases = data.get('test_cases', [])
        if not original_code or not user_fix or not test_cases:
            return jsonify({'error': 'Original code, user fix, and test cases are required'}), 400

        ast.parse(user_fix)
        namespace = {}
        exec(user_fix, namespace)
        if 'solution' not in namespace:
            return jsonify({'valid': False, 'message': "Function must be named 'solution'"})

        # This logic is flawed for the example, but keeping it as per your original structure:
        # The logic checks if the user's fixed code gives the SAME result as the buggy code, 
        # which means the fix is NOT valid. This is counter-intuitive. 
        # I've kept the original logic's intent but fixed the execution flow for comparison.

        for inputs in test_cases:
            # This is complex and potentially unsafe; typically, you'd compare the fixed_result 
            # against a known correct output, not the buggy one.
            # Assuming 'inputs' is a tuple/list for the arguments to the function
            
            # Executing buggy code to get the *buggy* result
            original_namespace = {}
            exec(original_code, original_namespace)
            
            # Executing fixed code to get the *fixed* result
            fixed_result = namespace['solution'](*inputs)
            
            # The core debugging challenge: if the original result EQUALS the fixed result, 
            # the bug might not have been fixed, OR the bug only happens with other inputs.
            # To pass, the fixed code must *not* match the buggy output AND must produce the correct result.
            
            # Since we don't know the correct output, we will assume the simple check: 
            # If the fixed code runs without crashing, it's a step up. 
            # The AI prompt below will ultimately judge the quality.

            # Simple test to see if the fix is syntactically/runtime valid for all test cases
            
            
            # If the original code execution was intended to provide the expected result (which it wasn't, it was buggy)
            # You need the correct expected output for a real unit test. 
            # Since you don't have it, let's just make the AI judge the fix based on the code provided.
            pass


        # Prompt the AI to evaluate the fix and provide a reference
        prompt = f"""
        The original buggy code was:
        {original_code}

        The candidate's fixed code is:
        {user_fix}

        Test cases (inputs): {test_cases}

        Please analyze the fix. 
        1. State whether the fix is logically valid and correct for the given problem (True/False).
        2. Provide a brief explanation.
        3. Provide the full, correct reference solution code for the problem.
        
        Respond with a single JSON object with keys: "valid" (Boolean), "message" (String), "reference_solution" (String).
        """
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        # Parse AI's evaluation
        ai_evaluation = json.loads(response.choices[0].message.content.strip())
        
        return jsonify({
            'valid': ai_evaluation.get('valid', False),
            'message': ai_evaluation.get('message', 'AI evaluation failed to parse.'),
            'reference_solution': ai_evaluation.get('reference_solution', 'Reference solution not available.')
        })
        
    except SyntaxError as e:
        return jsonify({'valid': False, 'message': f"Syntax Error in fixed code: {e}", 'reference_solution': None})
    except Exception as e:
        return jsonify({'valid': False, 'message': f"Runtime Error in fixed code: {e}", 'reference_solution': None})


# -------- Aptitude test routes --------
APTITUDE_PROMPT = """
You are an aptitude test generator. Create challenging questions ...
"""

@app.route('/start-aptitude-test', methods=['POST'])
def start_aptitude_test():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data received'}), 400
        category = data.get('category', 'quantitative')

        # Generate 10 questions at once
        questions = []
        for i in range(10):
            # Handle 'all' category by randomizing
            question_category = category
            if category == 'all':
                question_category = random.choice(['quantitative', 'logical', 'verbal'])
            
            prompt = f"""
            Generate a challenging {question_category} aptitude question with:
            1. A clear question statement
            2. 4 multiple choice options (labeled a, b, c, d)
            3. The correct answer (just the letter)
            4. A brief explanation
            Make this question unique and different from common questions.
            Format as JSON with keys: question, options, answer, explanation
            """

            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )

            try:
                question_data = json.loads(response.choices[0].message.content)
                questions.append(question_data)
            except:
                # Fallback question if parsing fails
                questions.append({
                    'question': f"Sample {question_category} question {i+1}?",
                    'options': {'a': "Option A", 'b': "Option B", 'c': "Option C", 'd': "Option D"},
                    'answer': "b",
                    'explanation': "This is why option B is correct"
                })

        return jsonify({'questions': questions})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/evaluate-aptitude-answer', methods=['POST'])
def evaluate_aptitude_answer():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data received'}), 400
        user_answer = data.get('user_answer', '').lower().strip()
        correct_answer = data.get('correct_answer', '').lower().strip()
        if not user_answer or not correct_answer:
            return jsonify({'error': 'Both user answer and correct answer are required'}), 400
        return jsonify({'correct': user_answer == correct_answer})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============ DSA PRACTICE ENDPOINTS ============
@app.route('/start-dsa-challenge', methods=['POST'])
def start_dsa_challenge():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data received'}), 400
        
        language = data.get('language', 'python')
        difficulty = data.get('difficulty', 'easy')
        
        prompt = f"""
        Generate a {difficulty} level Data Structures and Algorithms problem in {language}.
        The problem should:
        1. Have a clear title
        2. Have a detailed description (2-3 sentences)
        3. Include 3 examples with explanations
        4. Have constraints
        5. Have 3 test cases
        6. Include a reference solution in {language}
        7. Include hints for solving it
        
        Format as JSON with keys:
        - id: unique problem id
        - title: problem title
        - description: detailed description
        - examples: list of {{input, output, explanation}}
        - constraints: list of constraints
        - test_cases: list of {{input, expected_output}}
        - reference_solution: {language} code solution
        - hint: hint for solving
        
        Return only valid JSON.
        """
        
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        try:
            problem_data = json.loads(response.choices[0].message.content)
        except:
            # Fallback problem if parsing fails
            problem_data = {
                'id': 'dsa_001',
                'title': f'Array {difficulty.capitalize()} Problem',
                'description': f'Write a function to solve this {difficulty} level array problem.',
                'examples': [
                    {'input': '[1, 2, 3]', 'output': '[3, 2, 1]', 'explanation': 'Reverse the array'},
                    {'input': '[5, 4, 3]', 'output': '[3, 4, 5]', 'explanation': 'Sort the array'},
                    {'input': '[1, 1, 2]', 'output': '[1, 2]', 'explanation': 'Remove duplicates'}
                ],
                'constraints': ['1 <= n <= 10^5', 'Time Complexity: O(n)', 'Space Complexity: O(1)'],
                'test_cases': [
                    {'input': '[1, 2, 3]', 'expected_output': '[3, 2, 1]'},
                    {'input': '[5]', 'expected_output': '[5]'},
                    {'input': '[]', 'expected_output': '[]'}
                ],
                'reference_solution': '# Solution here',
                'hint': 'Think about how to manipulate the data structure efficiently'
            }
        
        return jsonify({'problem': problem_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/evaluate-dsa-solution', methods=['POST'])
def evaluate_dsa_solution():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data received'}), 400
        
        language = data.get('language', 'python')
        code = data.get('code', '')
        test_cases = data.get('test_cases', [])
        
        if not code:
            return jsonify({'error': 'No code provided'}), 400
        
        # Create evaluation prompt
        eval_prompt = f"""
        Evaluate the following {language} solution against test cases.
        
        Code:
        {code}
        
        Test Cases:
        {json.dumps(test_cases)}
        
        Respond with JSON containing:
        - passed: boolean (true if all tests pass)
        - message: evaluation message
        - failed_test_case: {{input, expected, got}} (if failed)
        - time_complexity: estimated time complexity
        - space_complexity: estimated space complexity
        - hint: hint for improvement if solution is wrong
        - reference_solution: a reference solution (if original is wrong)
        
        Return only valid JSON.
        """
        
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": eval_prompt}],
            response_format={"type": "json_object"}
        )
        
        try:
            eval_data = json.loads(response.choices[0].message.content)
        except:
            # Fallback evaluation
            eval_data = {
                'passed': False,
                'message': 'Could not parse solution. Please check syntax.',
                'time_complexity': 'Unknown',
                'space_complexity': 'Unknown',
                'hint': 'Review your code for syntax errors'
            }
        
        return jsonify(eval_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============ DOMAIN-BASED MCQ ENDPOINTS ============
@app.route('/get-domain-mcq', methods=['POST'])
def get_domain_mcq():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data received'}), 400
        
        domain = data.get('domain', '')
        num_questions = data.get('num_questions', 20)
        
        if not domain:
            return jsonify({'error': 'Domain name is required'}), 400
        
        questions = []
        used_questions = set()
        attempts = 0
        max_attempts = 50  # Prevent infinite loops
        
        while len(questions) < num_questions and attempts < max_attempts:
            attempts += 1
            
            prompt = f"""
            Generate a multiple choice question about {domain}.
            The question should be:
            1. Unique and not commonly repeated
            2. Specific to the {domain} domain
            3. Educational and relevant for professionals in this field
            4. Not duplicate of typical interview questions
            
            Format as JSON with keys:
            - question: the question text
            - options: object with keys a, b, c, d containing option texts
            - answer: single letter (a, b, c, or d)
            - explanation: brief explanation of why the answer is correct
            
            Make sure the question is completely different from this list (these have already been generated):
            {json.dumps(list(used_questions)[:5]) if used_questions else '[]'}
            
            Return only valid JSON.
            """
            
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            
            try:
                question_data = json.loads(response.choices[0].message.content)
                question_text = question_data.get('question', '').lower().strip()
                
                # Check if question is unique
                if question_text not in used_questions:
                    used_questions.add(question_text)
                    question_data['answer'] = question_data.get('answer', 'a').lower()
                    questions.append(question_data)
            except:
                # Skip failed parsing and try again
                continue
        
        if len(questions) < num_questions:
            return jsonify({
                'error': f'Could only generate {len(questions)} unique questions for {domain}. Try a more specific domain.'
            }), 400
        
        return jsonify({'questions': questions[:num_questions]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Add a route to serve the index.html file
@app.route('/')
def home():
    return app.send_static_file('index.html')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)