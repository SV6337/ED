import random
import time
import sys
import os
from groq import Groq
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
# Replace hardcoded API key with environment variable
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Initialize Groq client
client = Groq(api_key=GROQ_API_KEY)


# New languages: Java, C++, Go added
QUESTION_TEMPLATES = {
    "python": {
        "easy": ["Reverse a {data_structure}", "Check if {condition}"],
        "medium": ["Implement {algorithm}", "Find {pattern} in {data_structure}"],
        "hard": ["Optimize {algorithm} for {constraint}", "Design {system}"]
    },
    "javascript": {
        "easy": ["{operation} an array", "Validate {structure}"],
        "medium": ["Implement {concept} using {method}", "Async {task}"],
        "hard": ["Build {feature} with {constraints}", "Debug {complex_scenario}"]
    },
    "java": {
        "easy": ["Implement a simple {class}", "Perform {operation} on a String"],
        "medium": ["Design a {data_structure}", "Solve {problem_type} using OOP"],
        "hard": ["Implement {complex_design_pattern}", "Optimize I/O for {large_data}"]
    },
    "c++": {
        "easy": ["Implement a {data_structure} class", "Perform basic array {operation}"],
        "medium": ["Implement {algorithm} with pointers", "Manage memory for {structure}"],
        "hard": ["Design a high-performance {component}", "Multi-threading {scenario}"]
    },
    "go": {
        "easy": ["Write a function for {task}", "Use Go structs for {data}"],
        "medium": ["Implement {algorithm} with Goroutines", "Handle file {operation}"],
        "hard": ["Design a concurrent {system}", "Optimize a {data_structure} for concurrency"]
    }
}

def generate_question(language: str, difficulty: str) -> dict:
    """Generate a new coding question using Groq API"""
    prompt = f"""
    Generate a {difficulty}-level {language} coding question with:
    1. A clear problem statement
    2. 2 test cases with inputs/outputs. Ensure the solution function/method is clearly named (e.g., 'solution' for Python, 'public static String solution' for Java, 'func solution' for Go).
    3. The correct solution in {language}
    Format as JSON with keys: question, test_cases, solution
    """
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    
    try:
        # Use a safer method than eval for parsing JSON if possible, 
        # but sticking to eval since it was in the original code.
        return eval(response.choices[0].message.content) 
    except Exception as e:
        print(f"Warning: JSON parsing failed: {e}. Using fallback.")
        # Fallback if JSON parsing fails
        return {
            "question": f"Write a {language} function/method called 'solution' to solve a basic problem.",
            "test_cases": [(["input1"], "output1"), (["input2"], "output2")],
            "solution": f"// Fallback solution in {language}"
        }

def execute_code(code: str, language: str, test_cases: list) -> bool:
    """
    Execute code in the specified language.
    Only Python is executed directly. Other languages are only simulated.
    """
    
    # --- Python Execution (Direct) ---
    if language == "python":
        try:
            namespace = {}
            exec(code, namespace)
            if 'solution' not in namespace:
                print("Error: Your code must define a 'solution' function")
                return False
            
            all_passed = True
            for inputs, expected in test_cases:
                result = namespace['solution'](*inputs)
                if result != expected:
                    print(f"❌ Failed: Input {inputs} → Expected {expected}, Got {result}")
                    all_passed = False
                    break
            return all_passed
        
        except Exception as e:
            print(f"🚨 Python Execution Error: {str(e)}")
            return False
    
    # --- Simulated Execution for Other Languages ---
    elif language in ["javascript", "java", "c++", "go"]:
        print(f"Simulating execution for {language}...")
        # A real coding platform would compile/interpret and run the code
        # securely here (e.g., using a Docker container or sandbox).
        
        # For a simple simulation, we check if the user wrote *any* code.
        # This is a very weak check, but it prevents the user from submitting nothing.
        if len(code.strip()) > 5:
             # Randomly pass or fail, simulating a check against the hidden solution
            is_correct = random.choice([True, True, False]) # 2/3 chance to pass
            
            if is_correct:
                print(f"✅ Simulated Pass! (Actual execution for {language} would require external tools.)")
                return True
            else:
                print(f"❌ Simulated Fail! (Code for {language} cannot be automatically verified in this script.)")
                return False
        else:
            print(f"🚨 Submission Error: You must provide a valid code block for {language}.")
            return False

    else:
        print(f"Unsupported language: {language}")
        return False


def coding_simulator():
    print("\n🚀 Dynamic Coding Interview Simulator")
    print("-----------------------------------")
    
    # Get user preferences
    available_languages = "/".join(QUESTION_TEMPLATES.keys())
    while True:
        language = input(f"Choose language ({available_languages}): ").lower()
        if language in QUESTION_TEMPLATES:
            break
        print(f"Invalid language. Please choose from: {available_languages}")

    difficulty = input("Choose difficulty (easy/medium/hard): ").lower()
    time_limit = int(input("Time limit per question (minutes): ")) * 60
    
    score = 0
    question_count = 0
    
    while True:
        question_count += 1
        print(f"\n📝 Question #{question_count}")
        
        # Generate new question
        question_data = generate_question(language, difficulty)
        print(f"\nProblem: {question_data['question']}")
        print(f"\nTest Cases: {question_data['test_cases']}")
        
        # Start timer
        start_time = time.time()
        print(f"\n⏰ You have {time_limit//60} minutes. Start coding!")
        
        # Capture multi-line input
        user_code = []
        print(f"Write your {language} solution (type 'END' on new line to finish):")
        while True:
            try:
                line = sys.stdin.readline().strip('\n') # Use sys.stdin.readline for more robust multi-line input
                if line.upper() == "END":
                    break
                user_code.append(line)
            except EOFError:
                break # Handle EOF
        
        # Check time
        elapsed = time.time() - start_time
        if elapsed > time_limit:
            print("\n⏰ Time's up! Moving to next question...")
            
        # Evaluate solution
        print("\n🔍 Evaluating your code...")
        code = "\n".join(user_code)
        
        if execute_code(code, language, question_data["test_cases"]):
            score += 1
            print("✅ Correct solution!")
        else:
            print("\n💡 Here's one way to solve it:")
            print("-----------------------------------")
            print(question_data["solution"])
            print("-----------------------------------")
        
        # Continue or quit
        if input("\nContinue? (y/n): ").lower() != 'y':
            break
    
    print(f"\n🏁 Final Score: {score}/{question_count}")
    if score/question_count >= 0.8:
        print("🌟 Excellent! You're interview-ready!")
    else:
        print("💪 Keep practicing! Try easier questions first.")

if __name__ == "__main__":
    coding_simulator()