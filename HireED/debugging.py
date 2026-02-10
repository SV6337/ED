import ast
import sys
from textwrap import dedent
from groq import Groq
import random
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Groq client
client = Groq(api_key=os.getenv("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"))

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
                "test_cases": [([1,3,5,7], 5), ([], 1)],
                "hint": "Check boundary conditions carefully"
            }
        ]
    }
}

def validate_fix(original_code, user_fix, test_cases):
    """Validate the user's debugged solution"""
    try:
        # Validate syntax first
        ast.parse(user_fix)
        
        # Create execution namespace
        namespace = {}
        exec(user_fix, namespace)
        
        # Check if the function 'solution' is defined
        func_name = 'solution'
        if 'solution' not in namespace:
            return False, "Function must be named 'solution'"
        
        # Test each case
        for inputs in test_cases:
            try:
                # Execute original code
                original_namespace = {}
                exec(original_code, original_namespace)
                # Note: This is an oversimplification and might not work for all bugs
                original_result = original_namespace['add'](*inputs)
            except (KeyError, TypeError):
                 original_result = None # Handle cases where original code errors out
            
            try:
                # Execute fixed code
                fixed_result = namespace[func_name](*inputs)
                
                if original_result == fixed_result:
                    return False, f"Bug still exists for input {inputs}"
                    
            except Exception as e:
                return False, f"Runtime error with input {inputs}: {str(e)}"
                
        return True, "All bugs fixed!"
    
    except SyntaxError as e:
        return False, f"Syntax Error: {e}"
    except Exception as e:
        return False, f"Runtime Error: {e}"


def get_ai_debug_hint(buggy_code, error):
    """Get AI-powered debugging suggestions"""
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{
            "role": "user", 
            "content": f"Explain the bug in this code and give a one-line hint:\n{buggy_code}\nError: {error}"
        }]
    )
    return response.choices[0].message.content

def debugging_challenge():
    print("\n🔍 Debugging Challenge Mode")
    print("--------------------------")
    
    language = "python"  # Can expand to other languages later
    difficulty = input("Choose difficulty (easy/medium/hard): ").lower()
    
    # Select random challenge
    challenge = random.choice(DEBUGGING_CHALLENGES[language][difficulty])
    
    print("\n✏️ Debug this code:")
    print(challenge["buggy_code"])
    print("\n🧪 Test Cases:", challenge["test_cases"])
    
    user_fix = []
    print("\nWrite your fixed code (type 'DONE' when finished):")
    while True:
        line = input()
        if line.strip().upper() == "DONE":
            break
        user_fix.append(line)
    
    is_valid, message = validate_fix(
        challenge["buggy_code"], 
        "\n".join(user_fix), 
        challenge["test_cases"]
    )
    
    if is_valid:
        print("✅ " + message)
    else:
        print("❌ " + message)
        print("\n💡 Hint:", challenge["hint"])
        
        # Get AI-powered debug help
        if input("\nWant detailed AI explanation? (y/n): ").lower() == 'y':
            print("\n🤖 AI Debug Assistant:")
            print(get_ai_debug_hint(challenge["buggy_code"], message))
    
    # Show reference solution
    if input("\nShow reference solution? (y/n): ").lower() == 'y':
        print("\n📖 Reference Solution:")
        print(generate_reference_solution(challenge))

def generate_reference_solution(challenge):
    """Generate solution using Groq API"""
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{
            "role": "user", 
            "content": f"Provide a fixed version of this code:\n{challenge['buggy_code']}\nTest Cases: {challenge['test_cases']}"
        }]
    )
    return response.choices[0].message.content

if __name__ == "__main__":
    debugging_challenge()