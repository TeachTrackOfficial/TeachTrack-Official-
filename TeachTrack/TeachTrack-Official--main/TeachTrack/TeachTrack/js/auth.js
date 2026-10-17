
import { auth, db } from "./teachtrack-client.js";

import {
    signInWithEmailAndPassword,
    signOut
} from "./teachtrack-client.js";

import {
    doc,
    getDoc
} from "./teachtrack-client.js";


// LOGIN ELEMENTS
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");


// DISPLAY LOGIN MESSAGES
function showMessage(message, isError = false) {
    if (!loginMessage) {
        console.log(message);
        return;
    }

    loginMessage.textContent = message;
    loginMessage.className = isError
        ? "message error"
        : "message";
}


// FRIENDLY ERROR MESSAGES
function getLoginErrorMessage(error) {
    switch (error.code) {
        case "auth/invalid-email":
            return "Please enter a valid email address.";

        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
            return "Incorrect email or password.";

        case "auth/user-disabled":
            return "This account has been disabled. Contact your administrator.";

        case "auth/too-many-requests":
            return "Too many login attempts. Please try again later.";

        case "auth/network-request-failed":
            return "Network error. Please check your internet connection.";

        case "permission-denied":
            return "Access denied. Contact your school administrator.";

        default:
            return error.message || "Login failed. Please try again.";
    }
}


// LOGIN HANDLER
if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");

        const email = emailInput?.value.trim() || "";
        const password = passwordInput?.value || "";

        if (!email || !password) {
            showMessage("Please enter your username and password.", true);
            return;
        }

        const submitButton = loginForm.querySelector(
            'button[type="submit"]'
        );

        if (submitButton) {
            submitButton.disabled = true;
        }

        showMessage("Signing in...");

        try {
            // 1. SIGN IN THROUGH TEACHTRACK API
            const userCredential = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            const user = userCredential.user;

            // 2. LOAD THE EXISTING TEACHTRACK PROFILE
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            // NEVER AUTOMATICALLY CREATE AN ADMIN PROFILE
            if (!userSnap.exists()) {
                await signOut(auth);

                showMessage(
                    "Your account has no TeachTrack profile. Contact your administrator.",
                    true
                );

                return;
            }

            const userData = userSnap.data();

            // 3. CHECK THAT THE PROFILE IS VALID
            if (
                userData.email &&
                user.email &&
                userData.email.toLowerCase() !== user.email.toLowerCase()
            ) {
                await signOut(auth);

                showMessage(
                    "Your account information does not match. Contact your administrator.",
                    true
                );

                return;
            }

            // 4. REDIRECT BASED ON ROLE
            if (userData.role === "admin") {
                showMessage("Login successful! Opening admin dashboard...");

                window.location.replace("dashboard.html");

            } else if (userData.role === "teacher") {
                showMessage("Login successful! Opening teacher dashboard...");

                window.location.replace("teacher.html");

            } else {
                await signOut(auth);

                showMessage(
                    "Your account role is not recognized. Contact your administrator.",
                    true
                );
            }

        } catch (error) {
            console.error("TeachTrack login error:", error);

            showMessage(
                getLoginErrorMessage(error),
                true
            );

        } finally {
            if (submitButton) {
                submitButton.disabled = false;
            }
        }
    });
} else {
    console.error(
        "TeachTrack: Login form not found. Check the loginForm ID in index.html."
    );
}

// Teacher self-registration; administrators are provisioned separately.
const registerForm=document.getElementById('registerForm');
const showRegister=document.getElementById('showRegister');
const backToLogin=document.getElementById('backToLogin');
function switchForm(register){
 if(!registerForm||!loginForm)return;
 registerForm.hidden=!register;loginForm.hidden=register;
 const prompt=document.getElementById('registerPrompt');if(prompt)prompt.hidden=register;
 const heading=document.getElementById('authHeading');if(heading)heading.textContent=register?'Create Account':'Welcome Back';
 const subtitle=document.getElementById('authSubtitle');if(subtitle)subtitle.textContent=register?'Register as a teacher':'Sign in to access TeachTrack';
 document.getElementById('registerMessage').textContent='';
}
showRegister?.addEventListener('click',()=>switchForm(true));
backToLogin?.addEventListener('click',()=>switchForm(false));
registerForm?.addEventListener('submit',async e=>{
 e.preventDefault();
 const msg=document.getElementById('registerMessage');
 const password=document.getElementById('regPassword').value;
 if(password!==document.getElementById('regConfirm').value){msg.textContent='Passwords do not match.';return;}
 const btn=registerForm.querySelector('button[type="submit"]');btn.disabled=true;msg.textContent='Submitting...';
 try{
  const res=await fetch('/api/teachtrack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'register',name:document.getElementById('regName').value,username:document.getElementById('regEmail').value,password})});
  const data=await res.json();if(!res.ok)throw Error(data.error||'Registration failed');
  msg.textContent=data.message;registerForm.reset();
 }catch(err){msg.textContent=err.message;}finally{btn.disabled=false;}
});
