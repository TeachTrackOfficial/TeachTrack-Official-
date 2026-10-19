import { evaluateAvailability } from "./availability-core.mjs";
import {
    auth,
    db,
    firebaseConfig
} from "./teachtrack-client.js";

import {
    onAuthStateChanged,
    signOut,
    getAuth,
    createUserWithEmailAndPassword
} from "./teachtrack-client.js";

import {
    initializeApp,
    getApps
} from "./teachtrack-client.js";

import {
    doc,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    collection,
    getDocs,
    arrayUnion,
    serverTimestamp
} from "./teachtrack-client.js";


// =====================================================
// CURRENT USER
// =====================================================

let currentUser = null;
let currentUserData = null;


// =====================================================
// TEACHER CREATION APP
// =====================================================

let teacherApp = null;
let teacherAuth = null;

function getTeacherAuth() {

    const existingApp = getApps().find(
        app => app.name === "TeacherCreationApp"
    );

    if (existingApp) {
        teacherApp = existingApp;
    } else {
        teacherApp = initializeApp(
            firebaseConfig,
            "TeacherCreationApp"
        );
    }

    teacherAuth = getAuth(teacherApp);

    return teacherAuth;
}


// =====================================================
// REASSIGNMENT
// =====================================================

let reassignExcludedTeacherId = null;

let reassignmentData = null;


// =====================================================
// SETUP FLAGS
// =====================================================

let availabilitySetupDone = false;
let monthlySetupDone = false;


// =====================================================
// ROLE ELEMENTS
// =====================================================

const teacherElements =
    document.querySelectorAll(".teacher-only");

const adminElements =
    document.querySelectorAll(".admin-only");


function showForRole(role) {

    teacherElements.forEach(element => {

        element.style.display =
            role === "teacher" ? "" : "none";

    });

    adminElements.forEach(element => {

        element.style.display =
            role === "admin" ? "" : "none";

    });
}


// =====================================================
// AUTH CHECK
// =====================================================

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            window.location.href = "index.html";
            return;

        }

        currentUser = user;

        try {

            const userRef =
                doc(db, "users", user.uid);

            const userSnap =
                await getDoc(userRef);

            if (!userSnap.exists()) {

                console.error(
                    "User profile not found."
                );

                await signOut(auth);

                window.location.href =
                    "index.html";

                return;
            }

            currentUserData =
                userSnap.data();

            const name =
                currentUserData.name ||
                user.email?.split("@")[0] ||
                "User";

            const role =
                currentUserData.role ||
                "teacher";


            // =================================================
            // USER NAME
            // =================================================

            const userName =
                document.getElementById("userName");

            if (userName) {
                userName.textContent = name;
            }


            // =================================================
            // WELCOME NAME
            // =================================================

            const welcomeName =
                document.getElementById("welcomeName");

            if (welcomeName) {
                welcomeName.textContent = name;
            }


            // =================================================
            // ROLE
            // =================================================

            const userRole =
                document.getElementById("userRole");

            if (userRole) {

                userRole.textContent =
                    role === "admin"
                        ? "Administrator"
                        : "Teacher";

            }


            // =================================================
            // AVATAR
            // =================================================

            const avatar =
                document.querySelector(".profile-avatar");

            if (avatar) {

                avatar.textContent =
                    name
                        .charAt(0)
                        .toUpperCase();

            }


            showForRole(role);
            loadDate();


            // =================================================
            // ADMIN
            // =================================================

            if (role === "admin") {

                await loadTeachers();
                await loadTeacherDropdown();
                await loadAbsentTeacherDropdown();

                setupAvailability();

                await loadDeclineReviews();

                setupMonthlyRecords();
            }


            // =================================================
            // TEACHER
            // =================================================

            if (role === "teacher") {

                await loadTeacherSchedule();
                await loadTeacherRequests();

            }

        } catch (error) {

            console.error(
                "Dashboard error:",
                error
            );

        }

    }
);


// =====================================================
// DATE
// =====================================================

function loadDate() {

    const dateElement =
        document.getElementById("currentDate");

    if (!dateElement) {
        return;
    }

    dateElement.textContent =
        new Date().toLocaleDateString(
            "en-US",
            {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            }
        );
}


// =====================================================
// NAVIGATION
// =====================================================

document.querySelectorAll(".nav-item").forEach(
    button => {

        button.addEventListener(
            "click",
            async () => {

                document.querySelectorAll(
                    ".nav-item"
                ).forEach(item => {

                    item.classList.remove("active");

                });

                button.classList.add("active");


                document.querySelectorAll(
                    ".page-section"
                ).forEach(section => {

                    section.classList.remove("active");

                });


                const section =
                    document.getElementById(
                        button.dataset.section
                    );

                if (section) {
                    section.classList.add("active");
                }


                const pageTitle =
                    document.getElementById("pageTitle");

                if (pageTitle) {

                    pageTitle.textContent =
                        button.textContent.trim();

                }


                // ---------------------------------------------
                // ADMIN DECLINE REVIEWS
                // ---------------------------------------------

                if (
                    button.dataset.section ===
                    "declineReviews"
                ) {

                    await loadDeclineReviews();

                }


                // ---------------------------------------------
                // MONTHLY RECORDS
                // ---------------------------------------------

                if (
                    button.dataset.section ===
                    "records"
                ) {

                    await loadMonthlyRecords();

                }


                // ---------------------------------------------
                // TEACHER REQUESTS
                // ---------------------------------------------

                if (
                    button.dataset.section ===
                    "requests"
                ) {

                    await loadTeacherRequests();

                }


                // ---------------------------------------------
                // TEACHER SCHEDULE
                // ---------------------------------------------

                if (
                    button.dataset.section ===
                    "schedule" &&
                    currentUserData?.role ===
                    "teacher"
                ) {

                    await loadTeacherSchedule();

                }

            }
        );

    }
);


// =====================================================
// LOGOUT
// =====================================================

const logoutBtn =
    document.getElementById("logoutBtn");

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async (event) => {

            event.preventDefault();

            try {

                await signOut(auth);

                window.location.href =
                    "index.html";

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

            }

        }
    );

}


// =====================================================
// LOAD TEACHERS
// =====================================================

async function loadTeachers() {

    const teacherList =
        document.getElementById("teacherList");

    if (!teacherList) {
        return;
    }

    teacherList.innerHTML =
        "Loading teachers...";

    try {

        const snapshot =
            await getDocs(
                collection(db, "users")
            );

        teacherList.innerHTML = "";

        let teacherCount = 0;

        snapshot.forEach(userDoc => {

            const data =
                userDoc.data();

            if (data.role !== "teacher") {
                return;
            }

            teacherCount++;

            const name =
                data.name ||
                "Unnamed Teacher";

            const card =
                document.createElement("div");

            card.className =
                "teacher-card";

            card.innerHTML = `

                <div class="teacher-card-avatar">
                    ${escapeHTML(
                        name.charAt(0).toUpperCase()
                    )}
                </div>

                <div>

                    <h3>
                        ${escapeHTML(name)}
                    </h3>

                    <p>
                        ${escapeHTML(
                            data.email || "No email"
                        )}
                    </p>

                    <span class="teacher-status">
                        Teacher
                    </span>

                </div>
                <button type="button" class="delete-teacher-btn" aria-label="Delete teacher account ${escapeHTML(name)}">Delete Account</button>

            `;

            const deleteButton = card.querySelector(".delete-teacher-btn");
            deleteButton.addEventListener("click", async () => {
                if (!window.confirm(`Permanently delete ${name}'s TeachTrack account? Their access will be revoked immediately. Existing school records will be retained.`)) return;
                if (window.prompt('Type DELETE to confirm permanent account deletion:') !== 'DELETE') return;
                deleteButton.disabled = true;
                deleteButton.textContent = "Deleting...";
                try {
                    const response = await fetch("/api/teachtrack", {
                        method: "POST",
                        credentials: "same-origin",
                        headers: {"Content-Type":"application/json"},
                        body: JSON.stringify({action:"deleteTeacher",teacherId:userDoc.id,confirmation:"DELETE"})
                    });
                    const result = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(result.error || "Unable to delete account");
                    await loadTeachers();
                } catch (error) {
                    alert(error.message || "Unable to delete teacher account.");
                    deleteButton.disabled = false;
                    deleteButton.textContent = "Delete Account";
                }
            });

            teacherList.appendChild(card);

        });

        if (teacherCount === 0) {

            teacherList.innerHTML = `
                <div class="loading">
                    No teacher accounts yet.
                </div>
            `;

        }

    } catch (error) {

        console.error(
            "Error loading teachers:",
            error
        );

        teacherList.innerHTML = `
            <div class="message error">
                Unable to load teachers.
            </div>
        `;

    }

}


// =====================================================
// CREATE TEACHER ACCOUNT
// =====================================================

const addTeacherBtn =
    document.getElementById("addTeacherBtn");

if (addTeacherBtn) {

    addTeacherBtn.addEventListener(
        "click",
        createTeacher
    );

}


async function createTeacher() {

    const nameInput =
        document.getElementById("teacherName");

    const emailInput =
        document.getElementById("teacherEmail");

    const passwordInput =
        document.getElementById("teacherPassword");

    const message =
        document.getElementById("teacherMessage");

    if (
        !nameInput ||
        !emailInput ||
        !passwordInput ||
        !message
    ) {
        return;
    }

    const name =
        nameInput.value.trim();

    const email =
        emailInput.value.trim();

    const password =
        passwordInput.value;


    if (!name || !email || !password) {

        message.textContent =
            "Please complete all fields.";

        message.className =
            "message error";

        return;
    }


    if (password.length < 10) {

        message.textContent =
            "Password must be at least 10 characters.";

        message.className =
            "message error";

        return;
    }


    if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(email)) {

        message.textContent =
            "Use a username (3–40 letters, numbers, dots, underscores or hyphens).";

        message.className =
            "message error";

        return;
    }


    addTeacherBtn.disabled = true;
    addTeacherBtn.textContent = "Creating...";


    try {

        const teacherAuth =
            getTeacherAuth();


        const credential =
            await createUserWithEmailAndPassword(
                teacherAuth,
                email,
                password
            );


        const teacherUser =
            credential.user;


        await setDoc(
            doc(
                db,
                "users",
                teacherUser.uid
            ),
            {
                name: name,
                email: email,
                role: "teacher"
            }
        );


        message.textContent =
            "Teacher account created successfully!";

        message.className =
            "message success";


        nameInput.value = "";
        emailInput.value = "";
        passwordInput.value = "";


        await loadTeachers();
        await loadTeacherDropdown();
        await loadAbsentTeacherDropdown();


    } catch (error) {

        console.error(
            "Create teacher error:",
            error
        );


        if (
            error.code ===
            "auth/email-already-in-use"
        ) {

            message.textContent =
                "That email is already registered.";

        } else if (
            error.code ===
            "auth/invalid-email"
        ) {

            message.textContent =
                "Use a username (3–40 letters, numbers, dots, underscores or hyphens).";

        } else if (
            error.code ===
            "auth/weak-password"
        ) {

            message.textContent =
                "Password is too weak. Use at least 6 characters.";

        } else {

            message.textContent =
                `${error.code || "Error"}: ${
                    error.message ||
                    "Something went wrong."
                }`;

        }

        message.className =
            "message error";


    } finally {

        addTeacherBtn.disabled = false;
        addTeacherBtn.textContent = "Add Teacher";

    }

}


// =====================================================
// LOAD TEACHER DROPDOWN
// =====================================================

async function loadTeacherDropdown() {

    const dropdown =
        document.getElementById(
            "scheduleTeacher"
        );

    if (!dropdown) {
        return;
    }

    try {

        const snapshot =
            await getDocs(
                collection(db, "users")
            );


        dropdown.innerHTML = `
            <option value="">
                Select a teacher
            </option>
        `;


        snapshot.forEach(userDoc => {

            const data =
                userDoc.data();

            if (data.role !== "teacher") {
                return;
            }


            const option =
                document.createElement("option");

            option.value =
                userDoc.id;

            option.textContent =
                data.name ||
                data.email ||
                "Unnamed Teacher";


            dropdown.appendChild(option);

        });


    } catch (error) {

        console.error(
            "Teacher dropdown error:",
            error
        );

    }

}


// =====================================================
// LOAD ABSENT TEACHER DROPDOWN
// =====================================================

async function loadAbsentTeacherDropdown() {

    const dropdown =
        document.getElementById(
            "absentTeacher"
        );

    if (!dropdown) {
        return;
    }

    try {

        const snapshot =
            await getDocs(
                collection(db, "users")
            );


        dropdown.innerHTML = `
            <option value="">
                Select absent teacher
            </option>
        `;


        snapshot.forEach(userDoc => {

            const data =
                userDoc.data();

            if (data.role !== "teacher") {
                return;
            }


            const option =
                document.createElement("option");

            option.value =
                userDoc.id;

            option.textContent =
                data.name ||
                data.email ||
                "Unnamed Teacher";


            dropdown.appendChild(option);

        });


    } catch (error) {

        console.error(
            "Absent teacher dropdown error:",
            error
        );

    }

}


// =====================================================
// ADD TEACHER SCHEDULE
// =====================================================

const addScheduleBtn =
    document.getElementById("addScheduleBtn");

if (addScheduleBtn) {

    addScheduleBtn.addEventListener(
        "click",
        addSchedule
    );

}


async function addSchedule() {

    const teacherInput =
        document.getElementById("scheduleTeacher");

    const dayInput =
        document.getElementById("scheduleDay");

    const startInput =
        document.getElementById("scheduleStart");

    const endInput =
        document.getElementById("scheduleEnd");

    const subjectInput =
        document.getElementById("scheduleSubject");

    const sectionInput =
        document.getElementById("scheduleSection");

    const message =
        document.getElementById("scheduleMessage");


    if (
        !teacherInput ||
        !dayInput ||
        !startInput ||
        !endInput ||
        !subjectInput ||
        !sectionInput ||
        !message
    ) {
        return;
    }


    const teacherId =
        teacherInput.value;

    const day =
        dayInput.value;

    const start =
        startInput.value;

    const end =
        endInput.value;

    const subject =
        subjectInput.value.trim();

    const section =
        sectionInput.value.trim();


    if (
        !teacherId ||
        !day ||
        !start ||
        !end ||
        !subject ||
        !section
    ) {

        message.textContent =
            "Please complete all schedule fields.";

        message.className =
            "message error";

        return;
    }


    if (
        timeToMinutes(start) >=
        timeToMinutes(end)
    ) {

        message.textContent =
            "End time must be later than start time.";

        message.className =
            "message error";

        return;
    }


    addScheduleBtn.disabled = true;
    addScheduleBtn.textContent = "Saving...";


    try {

        const scheduleData = {

            start: start,
            end: end,
            subject: subject,
            section: section

        };


        await setDoc(
            doc(
                db,
                "schedules",
                teacherId
            ),
            {

                teacherId: teacherId,

                [day]:
                    arrayUnion(scheduleData)

            },
            {
                merge: true
            }
        );


        message.textContent =
            "Schedule added successfully!";

        message.className =
            "message success";


        startInput.value = "";
        endInput.value = "";
        subjectInput.value = "";
        sectionInput.value = "";


    } catch (error) {

        console.error(
            "Schedule error:",
            error
        );


        message.textContent =
            `${error.code || "Error"}: ${
                error.message ||
                "Unable to save schedule."
            }`;

        message.className =
            "message error";


    } finally {

        addScheduleBtn.disabled = false;
        addScheduleBtn.textContent = "Add Schedule";

    }

}


// =====================================================
// AVAILABILITY SETUP
// =====================================================

function setupAvailability() {

    if (availabilitySetupDone) {
        return;
    }

    const dateInput =
        document.getElementById(
            "availabilityDate"
        );

    const checkButton =
        document.getElementById(
            "checkAvailabilityBtn"
        );


    if (!dateInput || !checkButton) {
        return;
    }


    const today =
        new Date();


    dateInput.value =
        formatDateInput(today);


    checkButton.addEventListener(
        "click",
        checkTeacherAvailability
    );


    availabilitySetupDone = true;

}


// =====================================================
// CHECK TEACHER AVAILABILITY
// =====================================================

async function checkTeacherAvailability() {

    const dateInput =
        document.getElementById(
            "availabilityDate"
        );

    const startInput =
        document.getElementById(
            "availabilityStart"
        );

    const endInput =
        document.getElementById(
            "availabilityEnd"
        );

    const container =
        document.getElementById(
            "availableTeachers"
        );

    const message =
        document.getElementById(
            "availabilityMessage"
        );

    const checkButton =
        document.getElementById(
            "checkAvailabilityBtn"
        );


    if (
        !dateInput ||
        !startInput ||
        !endInput ||
        !container ||
        !message ||
        !checkButton
    ) {
        return;
    }


    const date =
        dateInput.value;

    const startTime =
        startInput.value;

    const endTime =
        endInput.value;


    if (
        !date ||
        !startTime ||
        !endTime
    ) {

        message.textContent =
            "Please select a date, start time, and end time.";

        message.className =
            "message error";

        return;
    }


    if (
        timeToMinutes(startTime) >=
        timeToMinutes(endTime)
    ) {

        message.textContent =
            "End time must be later than start time.";

        message.className =
            "message error";

        return;
    }


    checkButton.disabled = true;
    checkButton.textContent = "Checking...";


    container.innerHTML = `
        <div class="loading">
            Checking teacher availability...
        </div>
    `;

    message.textContent = "";


    try {

        const usersSnapshot =
            await getDocs(
                collection(db, "users")
            );

        const schedulesSnapshot =
            await getDocs(
                collection(db, "schedules")
            );

        const requestsSnapshot =
            await getDocs(
                collection(db, "substituteRequests")
            );


        const selectedDate =
            new Date(`${date}T00:00:00`);


        const dayIndex =
            selectedDate.getDay();


        if (
            dayIndex === 0 ||
            dayIndex === 6
        ) {

            container.innerHTML = `
                <div class="loading">
                    No regular teacher schedules are available
                    on weekends.
                </div>
            `;

            message.textContent = "";

            return;
        }


        const dayNames = [
            "sunday",
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday"
        ];


        const selectedDay =
            dayNames[dayIndex];


        const requestedStart =
            timeToMinutes(startTime);

        const requestedEnd =
            timeToMinutes(endTime);


        // =================================================
        // CURRENTLY SUBSTITUTING
        // =================================================

        const substitutingTeacherIds =
            new Set();


        requestsSnapshot.forEach(requestDoc => {

            const request =
                requestDoc.data();


            if (request.date !== date) {
                return;
            }


            if (
                ![
                    "pending",
                    "accepted"
                ].includes(
                    request.status
                )
            ) {
                return;
            }


            if (!request.assignedTeacherId) {
                return;
            }


            const requestStart =
                timeToMinutes(
                    request.startTime
                );

            const requestEnd =
                timeToMinutes(
                    request.endTime
                );


            const overlaps =
                requestedStart < requestEnd &&
                requestedEnd > requestStart;


            if (overlaps) {

                substitutingTeacherIds.add(
                    request.assignedTeacherId
                );

            }

        });


        container.innerHTML = "";


        let teacherCount = 0;
        let availableCount = 0;


        usersSnapshot.forEach(userDoc => {

            const teacher =
                userDoc.data();


            if (teacher.role !== "teacher") {
                return;
            }


            const teacherId =
                userDoc.id;


            // =================================================
            // EXCLUDE TEACHER WHO DECLINED
            // =================================================

            if (
                reassignExcludedTeacherId &&
                teacherId ===
                reassignExcludedTeacherId
            ) {
                return;
            }


            teacherCount++;


            const teacherName =
                teacher.name ||
                "Unnamed Teacher";


            const isSubstituting =
                substitutingTeacherIds.has(
                    teacherId
                );


            const scheduleDoc =
                schedulesSnapshot.docs.find(
                    schedule =>
                        schedule.id === teacherId
                );


            // One authoritative, fail-closed evaluation of the approved timetable.
            const result = evaluateAvailability(
                scheduleDoc?.data() || null,
                selectedDay,
                startTime,
                endTime,
                isSubstituting,
                date
            );
            const status = result.available ? "available" : "class";
            const statusText = result.label;

            if (
                status === "available"
            ) {
                availableCount++;
            }


            const card =
                document.createElement("div");


            card.className =
                "teacher-card availability-card";


            const firstLetter =
                teacherName
                    .charAt(0)
                    .toUpperCase();


            card.innerHTML = `

                <div class="teacher-card-avatar">
                    ${escapeHTML(firstLetter)}
                </div>

                <div class="teacher-card-info">

                    <h3>
                        ${escapeHTML(teacherName)}
                    </h3>

                    <p>
                        ${escapeHTML(
                            teacher.email || ""
                        )}
                    </p>

                    <span class="availability-badge ${status}">
                        ${escapeHTML(statusText)}
                    </span>

                </div>

            `;


            // =================================================
            // AVAILABLE TEACHER
            // =================================================

            if (
                status === "available"
            ) {

                const requestButton =
                    document.createElement("button");


                requestButton.type = "button";

                requestButton.className =
                    "primary-btn";


                requestButton.textContent =
                    "Send Substitute Request";


                requestButton.addEventListener(
                    "click",
                    () => {

                        openRequestModal(
                            teacherId,
                            teacherName,
                            date,
                            startTime,
                            endTime
                        );

                    }
                );


                card.appendChild(
                    requestButton
                );

            }


            container.appendChild(card);

        });


        // =================================================
        // REASSIGNMENT NOTICE
        // =================================================

        if (
            reassignExcludedTeacherId
        ) {

            const notice =
                document.createElement("p");


            notice.className =
                "message";


            notice.textContent =
                "Reassignment mode: the teacher who declined the original request is excluded.";


            container.prepend(notice);

        }


        if (teacherCount === 0) {

            container.innerHTML = `
                <div class="loading">
                    No teacher accounts found.
                </div>
            `;

            return;
        }


        if (availableCount === 0) {

            message.textContent =
                "No teachers have a fully approved vacant period covering the selected time.";

            message.className =
                "message error";

        } else {

            message.textContent =
                `${availableCount} teacher(s) available.`;

            message.className =
                "message success";

        }


    } catch (error) {

        console.error(
            "Availability error:",
            error
        );


        container.innerHTML = `
            <div class="message error">
                Unable to check teacher availability.
            </div>
        `;


        message.textContent =
            `${error.code || "Error"}: ${
                error.message ||
                "Something went wrong."
            }`;

        message.className =
            "message error";


    } finally {

        checkButton.disabled = false;

        checkButton.textContent =
            "Check Availability";

    }

}


// =====================================================
// OPEN REQUEST MODAL
// =====================================================

async function openRequestModal(
    teacherId,
    teacherName,
    date,
    startTime,
    endTime
) {

    const modal =
        document.getElementById(
            "requestModal"
        );


    if (!modal) {
        return;
    }


    modal.dataset.teacherId =
        teacherId;

    modal.dataset.teacherName =
        teacherName;


    await loadAbsentTeacherDropdown();


    const dateInput =
        document.getElementById(
            "requestDate"
        );

    const startInput =
        document.getElementById(
            "requestStartTime"
        );

    const endInput =
        document.getElementById(
            "requestEndTime"
        );

    const substituteInput =
        document.getElementById(
            "substituteTeacher"
        );


    if (dateInput) {
        dateInput.value = date;
    }

    if (startInput) {
        startInput.value = startTime;
    }

    if (endInput) {
        endInput.value = endTime;
    }

    if (substituteInput) {
        substituteInput.value = teacherName;
    }


    // =================================================
    // REASSIGNMENT PREFILL
    // =================================================

    const absentTeacher =
        document.getElementById(
            "absentTeacher"
        );

    const subject =
        document.getElementById(
            "requestSubject"
        );

    const section =
        document.getElementById(
            "requestSection"
        );

    const requestMessageInput =
        document.getElementById(
            "requestMessageInput"
        );


    if (reassignmentData) {

        if (absentTeacher) {

            absentTeacher.value =
                reassignmentData.absentTeacherId ||
                "";

        }


        if (subject) {

            subject.value =
                reassignmentData.subject ||
                "";

        }


        if (section) {

            section.value =
                reassignmentData.gradeSection ||
                "";

        }


        if (requestMessageInput) {

            requestMessageInput.value =
                reassignmentData.requestMessage ||
                "";

        }

    } else {

        if (absentTeacher) {
            absentTeacher.value = "";
        }

        if (subject) {
            subject.value = "";
        }

        if (section) {
            section.value = "";
        }

        if (requestMessageInput) {
            requestMessageInput.value = "";
        }

    }


    const message =
        document.getElementById(
            "requestMessage"
        );


    if (message) {

        message.textContent = "";

        message.className =
            "message";

    }


    modal.classList.remove("hidden");
    modal.style.display = "flex";

}


// =====================================================
// CLOSE REQUEST MODAL
// =====================================================

const closeRequestModal =
    document.getElementById(
        "closeRequestModal"
    );


if (closeRequestModal) {

    closeRequestModal.addEventListener(
        "click",
        closeRequestModalFunction
    );

}


function closeRequestModalFunction() {

    const modal =
        document.getElementById(
            "requestModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.add("hidden");

    modal.style.display =
        "none";

}


// =====================================================
// SEND SUBSTITUTE REQUEST
// =====================================================

const sendRequestBtn =
    document.getElementById(
        "sendRequestBtn"
    );


if (sendRequestBtn) {

    sendRequestBtn.addEventListener(
        "click",
        sendSubstituteRequest
    );

}


async function sendSubstituteRequest() {

    const modal =
        document.getElementById(
            "requestModal"
        );

    const absentTeacher =
        document.getElementById(
            "absentTeacher"
        );

    const subject =
        document.getElementById(
            "requestSubject"
        );

    const section =
        document.getElementById(
            "requestSection"
        );

    const date =
        document.getElementById(
            "requestDate"
        );

    const startTime =
        document.getElementById(
            "requestStartTime"
        );

    const endTime =
        document.getElementById(
            "requestEndTime"
        );

    const requestMessageInput =
        document.getElementById(
            "requestMessageInput"
        );

    const message =
        document.getElementById(
            "requestMessage"
        );


    if (
        !modal ||
        !absentTeacher ||
        !subject ||
        !section ||
        !date ||
        !startTime ||
        !endTime ||
        !message
    ) {
        return;
    }


    const substituteTeacherId =
        modal.dataset.teacherId;


    const substituteTeacherName =
        modal.dataset.teacherName ||
        "Teacher";


    if (!substituteTeacherId) {

        message.textContent =
            "No substitute teacher selected.";

        message.className =
            "message error";

        return;
    }


    if (
        !absentTeacher.value ||
        !subject.value.trim() ||
        !section.value.trim() ||
        !date.value ||
        !startTime.value ||
        !endTime.value
    ) {

        message.textContent =
            "Please complete all request fields.";

        message.className =
            "message error";

        return;
    }


    // =================================================
    // CANNOT SUBSTITUTE THEMSELVES
    // =================================================

    if (
        absentTeacher.value ===
        substituteTeacherId
    ) {

        message.textContent =
            "The absent teacher cannot be selected as the substitute.";

        message.className =
            "message error";

        return;
    }


    if (
        timeToMinutes(startTime.value) >=
        timeToMinutes(endTime.value)
    ) {

        message.textContent =
            "End time must be later than start time.";

        message.className =
            "message error";

        return;
    }


    const absentTeacherOption =
        absentTeacher.options[
            absentTeacher.selectedIndex
        ];


    const absentTeacherName =
        absentTeacherOption
            ? absentTeacherOption.textContent
            : "Unknown Teacher";


    const requestMessage =
        requestMessageInput
            ? requestMessageInput.value.trim()
            : "";


    sendRequestBtn.disabled = true;

    sendRequestBtn.textContent =
        "Sending...";


    try {

        // =================================================
        // FINAL AVAILABILITY CHECK
        // Prevents sending to a teacher who became busy.
        // =================================================

        const requestsSnapshot =
            await getDocs(
                collection(
                    db,
                    "substituteRequests"
                )
            );


        const newStart =
            timeToMinutes(
                startTime.value
            );

        const newEnd =
            timeToMinutes(
                endTime.value
            );


        let teacherAlreadyBusy =
            false;


        requestsSnapshot.forEach(requestDoc => {

            const request =
                requestDoc.data();


            if (
                request.date !==
                date.value
            ) {
                return;
            }


            if (
                request.assignedTeacherId !==
                substituteTeacherId
            ) {
                return;
            }


            if (
                ![
                    "pending",
                    "accepted"
                ].includes(
                    request.status
                )
            ) {
                return;
            }


            const existingStart =
                timeToMinutes(
                    request.startTime
                );

            const existingEnd =
                timeToMinutes(
                    request.endTime
                );


            const overlaps =
                newStart < existingEnd &&
                newEnd > existingStart;


            if (overlaps) {

                teacherAlreadyBusy =
                    true;

            }

        });


        if (teacherAlreadyBusy) {

            message.textContent =
                "This teacher is no longer available for that time.";

            message.className =
                "message error";

            return;
        }


        // =================================================
        // CREATE REQUEST
        // =================================================

        const requestData = {

            requestedById:
                currentUser.uid,

            requestedByName:
                currentUserData.name ||
                currentUser.email ||
                "User",

            absentTeacherId:
                absentTeacher.value,

            absentTeacherName:
                absentTeacherName,

            subject:
                subject.value.trim(),

            gradeSection:
                section.value.trim(),

            date:
                date.value,

            startTime:
                startTime.value,

            endTime:
                endTime.value,

            assignedTeacherId:
                substituteTeacherId,

            assignedTeacherName:
                substituteTeacherName,

            status:
                "pending",

            declineReason:
                "",

            declineConfirmedBy:
                "",

            declineConfirmedAt:
                null,

            respondedAt:
                null,

            requestMessage:
                requestMessage,

            createdAt:
                serverTimestamp()

        };


        // =================================================
        // LINK REASSIGNMENT TO ORIGINAL REQUEST
        // =================================================

        if (reassignmentData) {

            requestData.isReassignment =
                true;

            requestData.reassignedFromRequestId =
                reassignmentData.requestId ||
                "";

        } else {

            requestData.isReassignment =
                false;

        }


        await addDoc(
            collection(
                db,
                "substituteRequests"
            ),
            requestData
        );


        message.textContent =
            reassignmentData
                ? "Reassignment request sent successfully!"
                : "Substitute request sent successfully!";

        message.className =
            "message success";


        subject.value = "";
        section.value = "";
        absentTeacher.value = "";


        if (requestMessageInput) {
            requestMessageInput.value = "";
        }


        // =================================================
        // RESET REASSIGNMENT
        // =================================================

        reassignExcludedTeacherId =
            null;

        reassignmentData =
            null;


        setTimeout(
            closeRequestModalFunction,
            800
        );


    } catch (error) {

        console.error(
            "Send request error:",
            error
        );


        message.textContent =
            `${error.code || "Error"}: ${
                error.message ||
                "Unable to send request."
            }`;

        message.className =
            "message error";


    } finally {

        sendRequestBtn.disabled =
            false;

        sendRequestBtn.textContent =
            "Send Request";

    }

}


// =====================================================
// TEACHER SCHEDULE
// =====================================================

async function loadTeacherSchedule() {

    if (!currentUser) {
        return;
    }


    const weeklyContainer =
        document.getElementById(
            "weeklySchedule"
        );

    const todayContainer =
        document.getElementById(
            "todaySchedule"
        );


    try {

        const scheduleSnap =
            await getDoc(
                doc(
                    db,
                    "schedules",
                    currentUser.uid
                )
            );


        if (!scheduleSnap.exists()) {

            if (weeklyContainer) {

                weeklyContainer.innerHTML = `
                    <div class="loading">
                        No schedule has been assigned yet.
                    </div>
                `;

            }


            if (todayContainer) {

                todayContainer.innerHTML = `
                    <div class="loading">
                        No schedule for today.
                    </div>
                `;

            }

            return;
        }


        const scheduleData =
            scheduleSnap.data();


        const days = [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday"
        ];


        // =================================================
        // WEEKLY
        // =================================================

        if (weeklyContainer) {

            weeklyContainer.innerHTML = "";

            let totalClasses = 0;


            days.forEach(day => {

                const classes =
                    scheduleData[day] || [];


                if (
                    !Array.isArray(classes) ||
                    classes.length === 0
                ) {
                    return;
                }


                classes.forEach(item => {

                    totalClasses++;


                    const card =
                        document.createElement("div");


                    card.className =
                        "schedule-card";


                    card.innerHTML = `

                        <h3>
                            ${escapeHTML(
                                capitalize(day)
                            )}
                        </h3>

                        <p>
                            ${escapeHTML(
                                formatTime(item.start)
                            )}
                            -
                            ${escapeHTML(
                                formatTime(item.end)
                            )}
                        </p>

                        <strong>
                            ${escapeHTML(
                                item.subject ||
                                "No subject"
                            )}
                        </strong>

                        <p>
                            ${escapeHTML(
                                item.section ||
                                "No section"
                            )}
                        </p>

                    `;


                    weeklyContainer.appendChild(
                        card
                    );

                });

            });


            if (totalClasses === 0) {

                weeklyContainer.innerHTML = `
                    <div class="loading">
                        No schedule has been assigned yet.
                    </div>
                `;

            }

        }


        // =================================================
        // TODAY
        // =================================================

        if (todayContainer) {

            const today =
                new Date();


            const dayNames = [
                "sunday",
                "monday",
                "tuesday",
                "wednesday",
                "thursday",
                "friday",
                "saturday"
            ];


            const todayName =
                dayNames[today.getDay()];


            const todayClasses =
                scheduleData[todayName] || [];


            todayContainer.innerHTML = "";


            if (
                !Array.isArray(todayClasses) ||
                todayClasses.length === 0
            ) {

                todayContainer.innerHTML = `
                    <div class="loading">
                        No classes scheduled for today.
                    </div>
                `;

            } else {

                todayClasses.forEach(item => {

                    const card =
                        document.createElement("div");


                    card.className =
                        "schedule-card";


                    card.innerHTML = `

                        <h3>
                            ${escapeHTML(
                                item.subject ||
                                "Class"
                            )}
                        </h3>

                        <p>
                            ${escapeHTML(
                                formatTime(item.start)
                            )}
                            -
                            ${escapeHTML(
                                formatTime(item.end)
                            )}
                        </p>

                        <p>
                            ${escapeHTML(
                                item.section ||
                                "No section"
                            )}
                        </p>

                    `;


                    todayContainer.appendChild(
                        card
                    );

                });

            }

        }


    } catch (error) {

        console.error(
            "Teacher schedule error:",
            error
        );


        if (weeklyContainer) {

            weeklyContainer.innerHTML = `
                <div class="message error">
                    Unable to load your schedule.
                </div>
            `;

        }


        if (todayContainer) {

            todayContainer.innerHTML = `
                <div class="message error">
                    Unable to load today's schedule.
                </div>
            `;

        }

    }

}


// =====================================================
// TEACHER REQUESTS
// =====================================================

async function loadTeacherRequests() {

    if (!currentUser) {
        return;
    }


    const pendingContainer =
        document.getElementById(
            "pendingRequests"
        );

    const allContainer =
        document.getElementById(
            "allRequests"
        );


    if (pendingContainer) {
        pendingContainer.innerHTML =
            "Loading requests...";
    }


    if (allContainer) {
        allContainer.innerHTML =
            "Loading requests...";
    }


    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "substituteRequests"
                )
            );


        if (pendingContainer) {
            pendingContainer.innerHTML = "";
        }


        if (allContainer) {
            allContainer.innerHTML = "";
        }


        let pendingCount = 0;
        let allCount = 0;


        snapshot.forEach(requestDoc => {

            const request =
                requestDoc.data();


            if (
                request.assignedTeacherId !==
                currentUser.uid
            ) {
                return;
            }


            allCount++;


            const card =
                createTeacherRequestCard(
                    requestDoc.id,
                    request
                );


            if (
                request.status ===
                "pending"
            ) {

                pendingCount++;


                if (pendingContainer) {

                    pendingContainer.appendChild(
                        createTeacherRequestCard(
                            requestDoc.id,
                            request
                        )
                    );

                }

            }


            if (allContainer) {

                allContainer.appendChild(
                    card
                );

            }

        });


        if (
            pendingContainer &&
            pendingCount === 0
        ) {

            pendingContainer.innerHTML = `
                <div class="loading">
                    No pending substitute requests.
                </div>
            `;

        }


        if (
            allContainer &&
            allCount === 0
        ) {

            allContainer.innerHTML = `
                <div class="loading">
                    No substitute requests found.
                </div>
            `;

        }


    } catch (error) {

        console.error(
            "Teacher requests error:",
            error
        );


        if (pendingContainer) {

            pendingContainer.innerHTML = `
                <div class="message error">
                    Unable to load requests.
                </div>
            `;

        }


        if (allContainer) {

            allContainer.innerHTML = `
                <div class="message error">
                    Unable to load requests.
                </div>
            `;

        }

    }

}


// =====================================================
// TEACHER REQUEST CARD
// =====================================================

function createTeacherRequestCard(
    requestId,
    request
) {

    const card =
        document.createElement("div");


    card.className =
        "request-card";


    card.innerHTML = `

        <div class="request-header">

            <div>

                <h3>
                    ${escapeHTML(
                        request.subject ||
                        "Substitute Request"
                    )}
                </h3>

                <p>
                    From:
                    <strong>
                        ${escapeHTML(
                            request.requestedByName ||
                            "Unknown"
                        )}
                    </strong>
                </p>

            </div>

            <span class="availability-badge ${
                getStatusClass(request.status)
            }">
                ${escapeHTML(
                    formatStatus(request.status)
                )}
            </span>

        </div>


        <div class="request-details">

            <div class="request-detail">
                <strong>Absent Teacher</strong>
                <span>
                    ${escapeHTML(
                        request.absentTeacherName ||
                        "Unknown"
                    )}
                </span>
            </div>


            <div class="request-detail">
                <strong>Grade / Section</strong>
                <span>
                    ${escapeHTML(
                        request.gradeSection ||
                        "No section"
                    )}
                </span>
            </div>


            <div class="request-detail">
                <strong>Date</strong>
                <span>
                    ${escapeHTML(
                        formatRequestDate(
                            request.date
                        )
                    )}
                </span>
            </div>


            <div class="request-detail">
                <strong>Time</strong>
                <span>
                    ${escapeHTML(
                        formatTime(
                            request.startTime
                        )
                    )}
                    -
                    ${escapeHTML(
                        formatTime(
                            request.endTime
                        )
                    )}
                </span>
            </div>

        </div>

    `;


    // =================================================
    // REQUEST MESSAGE
    // =================================================

    if (request.requestMessage) {

        const message =
            document.createElement("div");


        message.className =
            "request-message";


        message.innerHTML = `
            <strong>Message</strong>

            <p>
                ${escapeHTML(
                    request.requestMessage
                )}
            </p>
        `;


        card.appendChild(
            message
        );

    }


    // =================================================
    // PENDING ACTIONS
    // =================================================

    if (
        request.status ===
        "pending"
    ) {

        const actions =
            document.createElement("div");


        actions.className =
            "request-actions";


        const acceptButton =
            document.createElement("button");


        acceptButton.type =
            "button";


        acceptButton.className =
            "primary-btn";


        acceptButton.textContent =
            "Accept";


        acceptButton.addEventListener(
            "click",
            () =>
                acceptSubstituteRequest(
                    requestId
                )
        );


        const declineButton =
            document.createElement("button");


        declineButton.type =
            "button";


        declineButton.className =
            "danger-btn";


        declineButton.textContent =
            "Decline";


        declineButton.addEventListener(
            "click",
            () =>
                openDeclineModal(
                    requestId
                )
        );


        actions.appendChild(
            acceptButton
        );

        actions.appendChild(
            declineButton
        );


        card.appendChild(
            actions
        );

    }


    // =================================================
    // WAITING FOR ADMIN REVIEW
    // =================================================

    if (
        request.status ===
        "declined_pending_review"
    ) {

        const notice =
            document.createElement("p");


        notice.className =
            "message";


        notice.textContent =
            "Your decline has been submitted and is waiting for administrator review.";


        card.appendChild(
            notice
        );

    }


    // =================================================
    // CONFIRMED DECLINE
    // =================================================

    if (
        request.status ===
        "declined"
    ) {

        const notice =
            document.createElement("p");


        notice.className =
            "message";


        notice.textContent =
            "This request was declined and confirmed by the administrator.";


        card.appendChild(
            notice
        );

    }


    // =================================================
    // ACCEPTED
    // =================================================

    if (
        request.status ===
        "accepted"
    ) {

        const notice =
            document.createElement("p");


        notice.className =
            "message success";


        notice.textContent =
            "You accepted this substitute request.";


        card.appendChild(
            notice
        );

    }


    return card;

}


// =====================================================
// ACCEPT REQUEST
// =====================================================

async function acceptSubstituteRequest(
    requestId
) {

    if (!currentUser) {
        return;
    }


    const confirmed =
        window.confirm(
            "Accept this substitute request?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const requestRef =
            doc(
                db,
                "substituteRequests",
                requestId
            );


        const requestSnap =
            await getDoc(
                requestRef
            );


        if (!requestSnap.exists()) {

            alert(
                "This request no longer exists."
            );

            return;
        }


        const request =
            requestSnap.data();


        if (
            request.assignedTeacherId !==
            currentUser.uid
        ) {

            alert(
                "You are not assigned to this request."
            );

            return;
        }


        if (
            request.status !==
            "pending"
        ) {

            alert(
                "This request is no longer pending."
            );

            return;
        }


        await updateDoc(
            requestRef,
            {

                status:
                    "accepted",

                respondedAt:
                    serverTimestamp()

            }
        );


        alert(
            "Substitute request accepted!"
        );


        await loadTeacherRequests();


    } catch (error) {

        console.error(
            "Accept request error:",
            error
        );


        alert(
            "Unable to accept request: " +
            error.message
        );

    }

}


// =====================================================
// DECLINE MODAL
// =====================================================

function openDeclineModal(
    requestId
) {

    const modal =
        document.getElementById(
            "declineModal"
        );


    if (!modal) {
        return;
    }


    modal.dataset.requestId =
        requestId;


    const reason =
        document.getElementById(
            "declineReason"
        );


    const errorMessage =
        document.getElementById(
            "declineError"
        );


    if (reason) {
        reason.value = "";
    }


    if (errorMessage) {
        errorMessage.textContent = "";
    }


    modal.classList.remove("hidden");

    modal.style.display =
        "flex";

}


// =====================================================
// CLOSE DECLINE MODAL
// =====================================================

const closeModal =
    document.getElementById(
        "closeModal"
    );


if (closeModal) {

    closeModal.addEventListener(
        "click",
        () => {

            const modal =
                document.getElementById(
                    "declineModal"
                );


            if (modal) {

                modal.classList.add("hidden");

                modal.style.display =
                    "none";

            }

        }
    );

}


// =====================================================
// SUBMIT DECLINE
// =====================================================

const submitDecline =
    document.getElementById(
        "submitDecline"
    );


if (submitDecline) {

    submitDecline.addEventListener(
        "click",
        submitTeacherDecline
    );

}


async function submitTeacherDecline() {

    const modal =
        document.getElementById(
            "declineModal"
        );


    const reasonInput =
        document.getElementById(
            "declineReason"
        );


    const errorMessage =
        document.getElementById(
            "declineError"
        );


    if (
        !modal ||
        !reasonInput ||
        !errorMessage
    ) {
        return;
    }


    const requestId =
        modal.dataset.requestId;


    const reason =
        reasonInput.value.trim();


    if (!reason) {

        errorMessage.textContent =
            "Please provide a reason for declining the request.";

        return;
    }


    if (reason.length < 3) {

        errorMessage.textContent =
            "Please provide a more specific reason.";

        return;
    }


    submitDecline.disabled =
        true;

    submitDecline.textContent =
        "Submitting...";


    try {

        const requestRef =
            doc(
                db,
                "substituteRequests",
                requestId
            );


        const requestSnap =
            await getDoc(
                requestRef
            );


        if (!requestSnap.exists()) {

            errorMessage.textContent =
                "This request no longer exists.";

            return;
        }


        const request =
            requestSnap.data();


        if (
            request.assignedTeacherId !==
            currentUser.uid
        ) {

            errorMessage.textContent =
                "You are not assigned to this request.";

            return;
        }


        if (
            request.status !==
            "pending"
        ) {

            errorMessage.textContent =
                "This request is no longer pending.";

            return;
        }


        await updateDoc(
            requestRef,
            {

                status:
                    "declined_pending_review",

                declineReason:
                    reason,

                respondedAt:
                    serverTimestamp()

            }
        );


        modal.classList.add("hidden");

        modal.style.display =
            "none";


        reasonInput.value = "";

        errorMessage.textContent =
            "";


        alert(
            "Your decline has been submitted for administrator review."
        );


        await loadTeacherRequests();


    } catch (error) {

        console.error(
            "Teacher decline error:",
            error
        );


        errorMessage.textContent =
            `${error.code || "Error"}: ${
                error.message ||
                "Unable to submit decline."
            }`;


    } finally {

        submitDecline.disabled =
            false;

        submitDecline.textContent =
            "Submit Decline";

    }

}


// =====================================================
// ADMIN DECLINE REVIEWS
// =====================================================

async function loadDeclineReviews() {

    const container =
        document.getElementById(
            "declineReviewList"
        );


    if (!container) {
        return;
    }


    container.innerHTML = `
        <div class="loading">
            Loading decline reviews...
        </div>
    `;


    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "substituteRequests"
                )
            );


        const requests = [];


        snapshot.forEach(requestDoc => {

            const request =
                requestDoc.data();


            if (
                request.status ===
                "declined_pending_review"
            ) {

                requests.push({

                    id:
                        requestDoc.id,

                    ...request

                });

            }

        });


        requests.sort(
            (a, b) => {

                return (
                    getTimestampValue(
                        b.respondedAt ||
                        b.createdAt
                    ) -
                    getTimestampValue(
                        a.respondedAt ||
                        a.createdAt
                    )
                );

            }
        );


        container.innerHTML = "";


        if (
            requests.length === 0
        ) {

            container.innerHTML = `
                <div class="loading">
                    No substitute requests are waiting
                    for decline review.
                </div>
            `;

            return;
        }


        requests.forEach(request => {

            container.appendChild(
                createDeclineReviewCard(
                    request
                )
            );

        });


    } catch (error) {

        console.error(
            "Decline review error:",
            error
        );


        container.innerHTML = `
            <div class="message error">
                Unable to load decline reviews.
            </div>
        `;

    }

}


// =====================================================
// DECLINE REVIEW CARD
// =====================================================

function createDeclineReviewCard(
    request
) {

    const card =
        document.createElement("div");


    card.className =
        "request-card";


    card.innerHTML = `

        <div class="request-header">

            <div>

                <h3>
                    Declined Substitute Request
                </h3>

                <p>
                    Substitute Teacher:
                    <strong>
                        ${escapeHTML(
                            request.assignedTeacherName ||
                            "Unknown Teacher"
                        )}
                    </strong>
                </p>

            </div>

            <span class="availability-badge substituting">
                Needs Review
            </span>

        </div>


        <div class="request-details">

            <div class="request-detail">
                <strong>Absent Teacher</strong>
                <span>
                    ${escapeHTML(
                        request.absentTeacherName ||
                        "Unknown Teacher"
                    )}
                </span>
            </div>


            <div class="request-detail">
                <strong>Subject</strong>
                <span>
                    ${escapeHTML(
                        request.subject ||
                        "No subject"
                    )}
                </span>
            </div>


            <div class="request-detail">
                <strong>Grade / Section</strong>
                <span>
                    ${escapeHTML(
                        request.gradeSection ||
                        "No section"
                    )}
                </span>
            </div>


            <div class="request-detail">
                <strong>Date</strong>
                <span>
                    ${escapeHTML(
                        formatRequestDate(
                            request.date
                        )
                    )}
                </span>
            </div>


            <div class="request-detail">
                <strong>Time</strong>
                <span>
                    ${escapeHTML(
                        formatTime(
                            request.startTime
                        )
                    )}
                    -
                    ${escapeHTML(
                        formatTime(
                            request.endTime
                        )
                    )}
                </span>
            </div>

        </div>


        <div class="decline-reason">

            <strong>
                Teacher's Decline Reason
            </strong>

            <p>
                ${escapeHTML(
                    request.declineReason ||
                    "No reason provided."
                )}
            </p>

        </div>


        ${
            request.requestMessage
                ? `
                    <div class="request-message">

                        <strong>
                            Original Message
                        </strong>

                        <p>
                            ${escapeHTML(
                                request.requestMessage
                            )}
                        </p>

                    </div>
                `
                : ""
        }


        <div class="request-actions">

            <button
                class="primary-btn confirm-decline-btn"
                type="button"
            >
                Confirm Decline
            </button>

        </div>

    `;


    const confirmButton =
        card.querySelector(
            ".confirm-decline-btn"
        );


    if (confirmButton) {

        confirmButton.addEventListener(
            "click",
            () =>
                confirmDeclineReview(
                    request.id
                )
        );

    }


    return card;

}


// =====================================================
// CONFIRM DECLINE
// =====================================================

async function confirmDeclineReview(
    requestId
) {

    if (
        !currentUser ||
        !currentUserData
    ) {

        alert(
            "Your admin account information is not ready."
        );

        return;
    }


    const confirmed =
        window.confirm(
            "Confirm this teacher's decline?\n\nAfter confirmation, you can choose another available teacher."
        );


    if (!confirmed) {
        return;
    }


    try {

        const requestRef =
            doc(
                db,
                "substituteRequests",
                requestId
            );


        const requestSnap =
            await getDoc(
                requestRef
            );


        if (!requestSnap.exists()) {

            alert(
                "This request no longer exists."
            );

            return;
        }


        const request =
            requestSnap.data();


        if (
            request.status !==
            "declined_pending_review"
        ) {

            alert(
                "This request is no longer waiting for review."
            );


            await loadDeclineReviews();

            return;
        }


        await updateDoc(
            requestRef,
            {

                status:
                    "declined",

                declineConfirmedBy:
                    currentUser.uid,

                declineConfirmedAt:
                    serverTimestamp()

            }
        );


        alert(
            "Decline confirmed successfully."
        );


        await loadDeclineReviews();

        await loadMonthlyRecords();


        // =================================================
        // START REASSIGNMENT
        // =================================================

        prepareReassignment(
            requestId,
            request
        );


    } catch (error) {

        console.error(
            "Confirm decline error:",
            error
        );


        alert(
            `${error.code || "Error"}: ${
                error.message ||
                "Unable to confirm decline."
            }`
        );

    }

}


// =====================================================
// PREPARE REASSIGNMENT
// =====================================================

function prepareReassignment(
    requestId,
    request
) {

    // =================================================
    // EXCLUDE THE TEACHER WHO DECLINED
    // =================================================

    reassignExcludedTeacherId =
        request.assignedTeacherId ||
        null;


    // =================================================
    // SAVE ORIGINAL REQUEST INFORMATION
    // =================================================

    reassignmentData = {

        requestId:
            requestId,

        absentTeacherId:
            request.absentTeacherId ||
            "",

        absentTeacherName:
            request.absentTeacherName ||
            "",

        subject:
            request.subject ||
            "",

        gradeSection:
            request.gradeSection ||
            "",

        date:
            request.date ||
            "",

        startTime:
            request.startTime ||
            "",

        endTime:
            request.endTime ||
            "",

        requestMessage:
            request.requestMessage ||
            "",

        originalDeclinedTeacherId:
            request.assignedTeacherId ||
            ""

    };


    // =================================================
    // SET AVAILABILITY FIELDS
    // =================================================

    const dateInput =
        document.getElementById(
            "availabilityDate"
        );

    const startInput =
        document.getElementById(
            "availabilityStart"
        );

    const endInput =
        document.getElementById(
            "availabilityEnd"
        );


    if (dateInput) {

        dateInput.value =
            request.date;

    }


    if (startInput) {

        startInput.value =
            request.startTime;

    }


    if (endInput) {

        endInput.value =
            request.endTime;

    }


    // =================================================
    // GO TO DASHBOARD OVERVIEW
    // =================================================

    document.querySelectorAll(
        ".nav-item"
    ).forEach(item => {

        item.classList.remove(
            "active"
        );

    });


    const dashboardNav =
        document.querySelector(
            '[data-section="overview"]'
        );


    if (dashboardNav) {

        dashboardNav.classList.add(
            "active"
        );

    }


    document.querySelectorAll(
        ".page-section"
    ).forEach(section => {

        section.classList.remove(
            "active"
        );

    });


    const overview =
        document.getElementById(
            "overview"
        );


    if (overview) {

        overview.classList.add(
            "active"
        );

    }


    const pageTitle =
        document.getElementById(
            "pageTitle"
        );


    if (pageTitle) {

        pageTitle.textContent =
            "Dashboard";

    }


    const message =
        document.getElementById(
            "availabilityMessage"
        );


    if (message) {

        message.textContent =
            "Reassignment ready. Choose another available teacher below.";

        message.className =
            "message success";

    }


    // =================================================
    // CHECK AVAILABILITY
    // =================================================

    checkTeacherAvailability();

}


// =====================================================
// MONTHLY RECORDS SETUP
// =====================================================

function setupMonthlyRecords() {

    if (monthlySetupDone) {
        return;
    }


    const monthInput =
        document.getElementById(
            "recordMonth"
        );


    if (!monthInput) {
        return;
    }


    const today =
        new Date();


    monthInput.value =
        `${today.getFullYear()}-${String(
            today.getMonth() + 1
        ).padStart(2, "0")}`;


    monthInput.addEventListener(
        "change",
        loadMonthlyRecords
    );


    monthlySetupDone = true;


    loadMonthlyRecords();

}


// =====================================================
// LOAD MONTHLY RECORDS
// =====================================================

async function loadMonthlyRecords() {

    const container =
        document.getElementById(
            "monthlyRecords"
        );


    if (!container) {
        return;
    }


    const monthInput =
        document.getElementById(
            "recordMonth"
        );


    const selectedMonth =
        monthInput?.value || "";


    container.innerHTML = `
        <div class="loading">
            Loading monthly records...
        </div>
    `;


    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "substituteRequests"
                )
            );


        const records = [];


        snapshot.forEach(requestDoc => {

            const request =
                requestDoc.data();


            if (
                request.date &&
                request.date.startsWith(
                    selectedMonth
                )
            ) {

                records.push({

                    id:
                        requestDoc.id,

                    ...request

                });

            }

        });


        let accepted = 0;
        let declined = 0;


        records.forEach(record => {

            if (
                record.status ===
                "accepted"
            ) {

                accepted++;

            }


            // =================================================
            // BOTH DECLINED STATUSES COUNT AS DECLINED
            // =================================================

            if (
                [
                    "declined",
                    "declined_pending_review"
                ].includes(
                    record.status
                )
            ) {

                declined++;

            }

        });


        const totalElement =
            document.getElementById(
                "totalRequests"
            );


        const acceptedElement =
            document.getElementById(
                "acceptedRequests"
            );


        const declinedElement =
            document.getElementById(
                "declinedRequests"
            );


        if (totalElement) {

            totalElement.textContent =
                records.length;

        }


        if (acceptedElement) {

            acceptedElement.textContent =
                accepted;

        }


        if (declinedElement) {

            declinedElement.textContent =
                declined;

        }


        // =================================================
        // SORT RECORDS
        // =================================================

        records.sort((a, b) => {

            const dateCompare =
                a.date.localeCompare(
                    b.date
                );


            if (dateCompare !== 0) {
                return dateCompare;
            }


            return (
                timeToMinutes(
                    a.startTime
                ) -
                timeToMinutes(
                    b.startTime
                )
            );

        });


        container.innerHTML = "";


        if (
            records.length === 0
        ) {

            container.innerHTML = `
                <div class="loading">
                    No substitute records for this month.
                </div>
            `;

            return;
        }


        // =================================================
        // TABLE
        // =================================================

        const table =
            document.createElement(
                "table"
            );


        table.innerHTML = `

            <thead>

                <tr>

                    <th>Date</th>
                    <th>Absent Teacher</th>
                    <th>Substitute</th>
                    <th>Subject</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Decline Reason</th>

                </tr>

            </thead>

            <tbody></tbody>

        `;


        const tbody =
            table.querySelector(
                "tbody"
            );


        records.forEach(record => {

            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>
                    ${escapeHTML(
                        formatRequestDate(
                            record.date
                        )
                    )}
                </td>


                <td>
                    ${escapeHTML(
                        record.absentTeacherName ||
                        "Unknown"
                    )}
                </td>


                <td>
                    ${escapeHTML(
                        record.assignedTeacherName ||
                        "Unknown"
                    )}
                </td>


                <td>
                    ${escapeHTML(
                        record.subject ||
                        "No subject"
                    )}
                </td>


                <td>
                    ${escapeHTML(
                        formatTime(
                            record.startTime
                        )
                    )}
                    -
                    ${escapeHTML(
                        formatTime(
                            record.endTime
                        )
                    )}
                </td>


                <td>
                    ${escapeHTML(
                        formatStatus(
                            record.status
                        )
                    )}
                </td>


                <td>
                    ${escapeHTML(
                        record.declineReason ||
                        "-"
                    )}
                </td>

            `;


            tbody.appendChild(
                row
            );

        });


        container.appendChild(
            table
        );


    } catch (error) {

        console.error(
            "Monthly records error:",
            error
        );


        container.innerHTML = `
            <div class="message error">
                Unable to load monthly records.
            </div>
        `;

    }

}


// =====================================================
// HELPERS
// =====================================================

function timeToMinutes(
    time
) {

    if (!time) {
        return 0;
    }


    const parts =
        time.split(":");


    return (
        Number(parts[0]) * 60 +
        Number(parts[1] || 0)
    );

}


// =====================================================
// FORMAT TIME
// =====================================================

function formatTime(
    time
) {

    if (!time) {
        return "";
    }


    const parts =
        time.split(":");


    let hour =
        Number(parts[0]);


    const minute =
        parts[1] || "00";


    const ampm =
        hour >= 12
            ? "PM"
            : "AM";


    hour =
        hour % 12 || 12;


    return `${hour}:${minute} ${ampm}`;

}


// =====================================================
// FORMAT DATE
// =====================================================

function formatRequestDate(
    dateString
) {

    if (!dateString) {
        return "No date";
    }


    const parts =
        dateString.split("-");


    if (
        parts.length !== 3
    ) {

        return dateString;

    }


    const date =
        new Date(
            Number(parts[0]),
            Number(parts[1]) - 1,
            Number(parts[2])
        );


    return date.toLocaleDateString(
        "en-US",
        {
            month: "long",
            day: "numeric",
            year: "numeric"
        }
    );

}


// =====================================================
// FORMAT DATE INPUT
// =====================================================

function formatDateInput(
    date
) {

    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );


    return `${year}-${month}-${day}`;

}


// =====================================================
// FORMAT STATUS
// =====================================================

function formatStatus(
    status
) {

    switch (status) {

        case "pending":
            return "Pending";

        case "accepted":
            return "Accepted";

        case "declined_pending_review":
            return "Declined - For Review";

        case "declined":
            return "Declined";

        case "cancelled":
            return "Cancelled";

        default:
            return status || "Unknown";

    }

}


// =====================================================
// STATUS CSS CLASS
// =====================================================

function getStatusClass(
    status
) {

    switch (status) {

        case "pending":
            return "substituting";

        case "accepted":
            return "available";

        case "declined_pending_review":
            return "substituting";

        case "declined":
            return "class";

        default:
            return "class";

    }

}


// =====================================================
// FIRESTORE TIMESTAMP
// =====================================================

function getTimestampValue(
    timestamp
) {

    if (!timestamp) {
        return 0;
    }


    if (
        typeof timestamp.toMillis ===
        "function"
    ) {

        return timestamp.toMillis();

    }


    if (
        timestamp.seconds !==
        undefined
    ) {

        return timestamp.seconds * 1000;

    }


    return 0;

}


// =====================================================
// CAPITALIZE
// =====================================================

function capitalize(
    value
) {

    if (!value) {
        return "";
    }


    return (
        value.charAt(0).toUpperCase() +
        value.slice(1)
    );

}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}