import { auth, db } from "./teachtrack-client.js";

import {
    onAuthStateChanged,
    signOut
} from "./teachtrack-client.js";

import {
    doc,
    getDoc,
    getDocs,
    collection,
    query,
    where,
    updateDoc,
    serverTimestamp
} from "./teachtrack-client.js";


// =====================================================
// GLOBAL VARIABLES
// =====================================================

let currentUser = null;
let currentUserData = null;


// =====================================================
// AUTHENTICATION
// =====================================================

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "index.html";
        return;
    }

    currentUser = user;

    try {

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            console.error("User profile not found.");
            return;
        }

        currentUserData = userSnap.data();

        // Teacher only
        if (currentUserData.role !== "teacher") {
            window.location.href = "dashboard.html";
            return;
        }

        // Load teacher information
        loadTeacherInformation();

        // Load schedule
        await loadTeacherSchedule();

        // Load substitute requests
        await loadTeacherRequests();

        // Setup navigation
        setupNavigation();

        // Setup logout
        setupLogout();

        // Show current date
        loadCurrentDate();

    } catch (error) {

        console.error("AUTH ERROR:", error);

    }

});


// =====================================================
// TEACHER INFORMATION
// =====================================================

function loadTeacherInformation() {

    const teacherName =
        currentUserData.name || currentUser.email || "Teacher";

    const teacherEmail =
        currentUserData.email || currentUser.email || "";

    // Name
    const userName =
        document.getElementById("userName");

    if (userName) {
        userName.textContent = teacherName;
    }

    const welcomeName =
        document.getElementById("welcomeName");

    if (welcomeName) {
        welcomeName.textContent = teacherName;
    }

    // Role
    const userRole =
        document.getElementById("userRole");

    if (userRole) {
        userRole.textContent = "Teacher";
    }

    // Avatar
    const profileAvatar =
        document.getElementById("profileAvatar");

    if (profileAvatar) {

        profileAvatar.textContent =
            teacherName
                .charAt(0)
                .toUpperCase();

    }

    // Support old class-based elements if they exist
    const teacherNameElements =
        document.querySelectorAll(".teacher-name");

    teacherNameElements.forEach(element => {
        element.textContent = teacherName;
    });

    const teacherEmailElements =
        document.querySelectorAll(".teacher-email");

    teacherEmailElements.forEach(element => {
        element.textContent = teacherEmail;
    });

}


// =====================================================
// CURRENT DATE
// =====================================================

function loadCurrentDate() {

    const dateElement =
        document.getElementById("currentDate");

    if (!dateElement) {
        return;
    }

    const today = new Date();

    dateElement.textContent =
        today.toLocaleDateString(
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

function setupNavigation() {

    const navItems =
        document.querySelectorAll(".nav-item");

    const sections =
        document.querySelectorAll(".page-section");

    navItems.forEach(button => {

        button.addEventListener("click", () => {

            const targetSection =
                button.dataset.section;

            if (!targetSection) {
                return;
            }

            // Remove active from all buttons
            navItems.forEach(item => {
                item.classList.remove("active");
            });

            // Activate clicked button
            button.classList.add("active");

            // Hide all sections
            sections.forEach(section => {
                section.classList.remove("active");
            });

            // Show selected section
            const target =
                document.getElementById(targetSection);

            if (target) {
                target.classList.add("active");
            }

            // Update page title
            updatePageTitle(targetSection);

            // Scroll to top
            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

        });

    });

}


// =====================================================
// PAGE TITLE
// =====================================================

function updatePageTitle(section) {

    const pageTitle =
        document.getElementById("pageTitle");

    if (!pageTitle) {
        return;
    }

    switch (section) {

        case "teacherHome":
            pageTitle.textContent =
                "Teacher Dashboard";
            break;

        case "mySchedule":
            pageTitle.textContent =
                "My Schedule";
            break;

        case "substituteRequests":
            pageTitle.textContent =
                "Substitute Requests";
            break;

        default:
            pageTitle.textContent =
                "Teacher Dashboard";

    }

}


// =====================================================
// LOGOUT
// =====================================================

function setupLogout() {

    const logoutButton =
        document.getElementById("logoutBtn");

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener(
        "click",
        async (event) => {

            event.preventDefault();

            try {

                await signOut(auth);

                window.location.href =
                    "index.html";

            } catch (error) {

                console.error(
                    "LOGOUT ERROR:",
                    error
                );

                alert(
                    "Unable to sign out. Please try again."
                );

            }

        }
    );

}


// =====================================================
// LOAD TEACHER SCHEDULE
// =====================================================

async function loadTeacherSchedule() {

    const scheduleContainer =
        document.getElementById("weeklySchedule");

    if (!scheduleContainer) {
        return;
    }

    scheduleContainer.innerHTML =
        "<p>Loading schedule...</p>";

    try {

        const scheduleRef =
            doc(
                db,
                "schedules",
                currentUser.uid
            );

        const scheduleSnap =
            await getDoc(scheduleRef);

        if (!scheduleSnap.exists()) {

            scheduleContainer.innerHTML =
                `<div class="no-data">
                    No schedule has been assigned yet.
                </div>`;

            loadTodaySchedule({});

            return;
        }

        const scheduleData =
            scheduleSnap.data();

        const days = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday"
        ];

        scheduleContainer.innerHTML = "";

        let hasSchedule = false;

        days.forEach(day => {

            const daySchedule =
                Array.isArray(scheduleData[day.toLowerCase()])
                    ? scheduleData[day.toLowerCase()]
                    : [];

            const dayCard =
                document.createElement("div");

            dayCard.className =
                "schedule-day";

            let html = `
                <h3>${day}</h3>
            `;

            if (daySchedule.length === 0) {

                html += `
                    <p class="empty-schedule">
                        No classes
                    </p>
                `;

            } else {

                hasSchedule = true;

                daySchedule.forEach(schedule => {

                    html += `
                        <div class="schedule-item">

                            <strong>
                                ${escapeHTML(
                                    schedule.subject ||
                                    "No Subject"
                                )}
                            </strong>

                            <span>
                                ${formatTime(schedule.start)}
                                -
                                ${formatTime(schedule.end)}
                            </span>

                            <span>
                                ${escapeHTML(
                                    schedule.section ||
                                    "No Section"
                                )}
                            </span>

                        </div>
                    `;

                });

            }

            dayCard.innerHTML = html;

            scheduleContainer.appendChild(dayCard);

        });

        if (!hasSchedule) {

            scheduleContainer.innerHTML =
                `<div class="no-data">
                    No classes have been assigned yet.
                </div>`;

        }

        // Load today's schedule
        loadTodaySchedule(scheduleData);

    } catch (error) {

        console.error(
            "SCHEDULE ERROR:",
            error
        );

        scheduleContainer.innerHTML =
            `<p class="error">
                Unable to load schedule.
            </p>`;

    }

}


// =====================================================
// TODAY'S SCHEDULE
// =====================================================

function loadTodaySchedule(scheduleData) {

    const todayContainer =
        document.getElementById("todaySchedule");

    if (!todayContainer) {
        return;
    }

    const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
    ];

    const today =
        dayNames[new Date().getDay()];

    const todaySchedule =
        Array.isArray(scheduleData[today])
            ? scheduleData[today]
            : [];

    if (
        today === "Saturday" ||
        today === "Sunday"
    ) {

        todayContainer.innerHTML =
            `<div class="no-data">
                No classes today.
            </div>`;

        return;

    }

    if (todaySchedule.length === 0) {

        todayContainer.innerHTML =
            `<div class="no-data">
                No classes scheduled today.
            </div>`;

        return;

    }

    todayContainer.innerHTML = "";

    todaySchedule.forEach(schedule => {

        const item =
            document.createElement("div");

        item.className =
            "schedule-item";

        item.innerHTML = `
            <strong>
                ${escapeHTML(
                    schedule.subject ||
                    "No Subject"
                )}
            </strong>

            <span>
                ${formatTime(schedule.start)}
                -
                ${formatTime(schedule.end)}
            </span>

            <span>
                ${escapeHTML(
                    schedule.section ||
                    "No Section"
                )}
            </span>
        `;

        todayContainer.appendChild(item);

    });

}


// =====================================================
// LOAD SUBSTITUTE REQUESTS
// =====================================================

async function loadTeacherRequests() {

    const allRequestsContainer =
        document.getElementById("allRequests");

    const pendingContainer =
        document.getElementById("pendingRequests");

    if (!allRequestsContainer && !pendingContainer) {
        return;
    }

    if (allRequestsContainer) {

        allRequestsContainer.innerHTML =
            "<p>Loading requests...</p>";

    }

    if (pendingContainer) {

        pendingContainer.innerHTML =
            "<p>Loading requests...</p>";

    }

    try {

        const requestsSnapshot =
            await getDocs(
                query(
                    collection(db, "substituteRequests"),
                    where("assignedTeacherId", "==", currentUser.uid)
                )
            );

        const requests = [];

        requestsSnapshot.forEach(requestDoc => {

            const data =
                requestDoc.data();

            requests.push({
                id: requestDoc.id,
                ...data
            });

        });

        // Newest first
        requests.sort((a, b) => {

            const aTime =
                a.createdAt?.seconds || 0;

            const bTime =
                b.createdAt?.seconds || 0;

            return bTime - aTime;

        });


        // =============================================
        // PENDING REQUESTS
        // =============================================

        const pendingRequests =
            requests.filter(
                request =>
                    request.status === "pending"
            );

        if (pendingContainer) {

            if (pendingRequests.length === 0) {

                pendingContainer.innerHTML =
                    `<div class="no-data">
                        No pending substitute requests.
                    </div>`;

            } else {

                pendingContainer.innerHTML = "";

                pendingRequests.forEach(request => {

                    pendingContainer.appendChild(
                        createRequestCard(request)
                    );

                });

            }

        }


        // =============================================
        // ALL REQUESTS
        // =============================================

        if (allRequestsContainer) {

            if (requests.length === 0) {

                allRequestsContainer.innerHTML =
                    `<div class="no-data">
                        No substitute requests yet.
                    </div>`;

            } else {

                allRequestsContainer.innerHTML = "";

                requests.forEach(request => {

                    allRequestsContainer.appendChild(
                        createRequestCard(request)
                    );

                });

            }

        }

    } catch (error) {

        console.error(
            "LOAD REQUESTS ERROR:",
            error
        );

        const explanation = error.code === "permission-denied"
            ? "You don't have permission to view assigned requests. Ask the admin to check Firestore rules."
            : error.code === "unavailable"
                ? "Can't connect to Firebase right now. Check your internet connection and try again."
                : "Unable to load requests. Please try again or check the browser console.";
        for (const container of [allRequestsContainer, pendingContainer]) {
            if (!container) continue;
            container.textContent = "";
            const message = document.createElement("p");
            message.className = "error";
            message.textContent = explanation;
            container.appendChild(message);
        }

    }

}


// =====================================================
// CREATE REQUEST CARD
// =====================================================

function createRequestCard(request) {

    const card =
        document.createElement("div");

    card.className =
        "request-card";

    const statusInfo =
        getStatusInfo(request.status);

    let buttonsHTML = "";


    // =============================================
    // PENDING
    // =============================================

    if (request.status === "pending") {

        buttonsHTML = `
            <div class="request-actions">

                <button
                    class="accept-request-btn"
                    data-id="${request.id}">
                    Accept
                </button>

                <button
                    class="decline-request-btn"
                    data-id="${request.id}">
                    Decline
                </button>

            </div>
        `;

    }


    // =============================================
    // ACCEPTED
    // =============================================

    else if (request.status === "accepted") {

        buttonsHTML = `
            <div class="request-actions">

                <span class="request-completed">
                    ✓ Request Accepted
                </span>

            </div>
        `;

    }


    // =============================================
    // DECLINED - WAITING FOR ADMIN
    // =============================================

    else if (
        request.status ===
        "declined_pending_review"
    ) {

        buttonsHTML = `
            <div class="request-actions">

                <span class="request-completed">
                    Declined — Awaiting Admin Review
                </span>

            </div>
        `;

    }


    // =============================================
    // CONFIRMED DECLINE
    // =============================================

    else if (
        request.status === "declined"
    ) {

        buttonsHTML = `
            <div class="request-actions">

                <span class="request-completed">
                    Decline Confirmed by Admin
                </span>

            </div>
        `;

    }


    card.innerHTML = `

        <div class="request-header">

            <div>

                <h3>
                    Substitute Request
                </h3>

                <span
                    class="request-status
                    ${statusInfo.className}">
                    ${statusInfo.text}
                </span>

            </div>

        </div>


        <div class="request-details">

            <p>
                <strong>Absent Teacher:</strong>
                ${escapeHTML(
                    request.absentTeacherName ||
                    request.absentTeacher ||
                    "Unknown"
                )}
            </p>

            <p>
                <strong>Subject:</strong>
                ${escapeHTML(
                    request.subject ||
                    "Not specified"
                )}
            </p>

            <p>
                <strong>Section:</strong>
                ${escapeHTML(
                    request.gradeSection ||
                    request.section ||
                    "Not specified"
                )}
            </p>

            <p>
                <strong>Date:</strong>
                ${escapeHTML(
                    request.date ||
                    "Not specified"
                )}
            </p>

            <p>
                <strong>Time:</strong>
                ${formatTime(
                    request.startTime
                )}
                -
                ${formatTime(
                    request.endTime
                )}
            </p>

            <p>
                <strong>Requested by:</strong>
                ${escapeHTML(
                    request.requestedByName ||
                    "Unknown"
                )}
            </p>

            ${
                request.requestMessage
                    ? `
                    <p>
                        <strong>Message:</strong>
                        ${escapeHTML(
                            request.requestMessage
                        )}
                    </p>
                    `
                    : ""
            }

            ${
                request.declineReason
                    ? `
                    <div class="decline-reason">

                        <strong>
                            Your Decline Reason:
                        </strong>

                        <p>
                            ${escapeHTML(
                                request.declineReason
                            )}
                        </p>

                    </div>
                    `
                    : ""
            }

        </div>

        ${buttonsHTML}

    `;


    // =============================================
    // ACCEPT BUTTON
    // =============================================

    const acceptButton =
        card.querySelector(
            ".accept-request-btn"
        );

    if (acceptButton) {

        acceptButton.addEventListener(
            "click",
            async () => {

                await acceptRequest(
                    request.id
                );

            }
        );

    }


    // =============================================
    // DECLINE BUTTON
    // =============================================

    const declineButton =
        card.querySelector(
            ".decline-request-btn"
        );

    if (declineButton) {

        declineButton.addEventListener(
            "click",
            () => {

                openDeclineModal(
                    request.id
                );

            }
        );

    }


    return card;

}


// =====================================================
// ACCEPT REQUEST
// =====================================================

async function acceptRequest(requestId) {

    try {

        await updateDoc(
            doc(
                db,
                "substituteRequests",
                requestId
            ),
            {
                status: "accepted",
                respondedAt: serverTimestamp()
            }
        );

        alert(
            "Substitute request accepted."
        );

        await loadTeacherRequests();

    } catch (error) {

        console.error(
            "ACCEPT REQUEST ERROR:",
            error
        );

        alert(
            "Unable to accept the request: " + (error?.message || "Unknown error")
        );

    }

}


// =====================================================
// DECLINE MODAL
// =====================================================

function openDeclineModal(requestId) {

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

    if (!modal) {
        return;
    }

    modal.dataset.requestId =
        requestId;

    if (reasonInput) {
        reasonInput.value = "";
    }

    if (errorMessage) {
        errorMessage.textContent = "";
    }

    modal.style.display = "flex";

}


// =====================================================
// CLOSE DECLINE MODAL
// =====================================================

function closeDeclineModal() {

    const modal =
        document.getElementById(
            "declineModal"
        );

    if (modal) {
        modal.style.display = "none";
    }

}


// =====================================================
// SUBMIT DECLINE
// =====================================================

async function submitDecline() {

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

    if (!modal || !reasonInput) {
        return;
    }

    const requestId =
        modal.dataset.requestId;

    const reason =
        reasonInput.value.trim();


    // Reason is required
    if (!reason) {

        if (errorMessage) {

            errorMessage.textContent =
                "Please provide a reason for declining.";

        }

        return;

    }


    if (!requestId) {

        if (errorMessage) {

            errorMessage.textContent =
                "Request ID is missing.";

        }

        return;

    }


    try {

        await updateDoc(
            doc(
                db,
                "substituteRequests",
                requestId
            ),
            {
                status:
                    "declined_pending_review",

                declineReason:
                    reason,

                respondedAt:
                    serverTimestamp()
            }
        );


        closeDeclineModal();

        alert(
            "Request declined. Your reason has been sent to the administrator for review."
        );

        await loadTeacherRequests();

    } catch (error) {

        console.error(
            "DECLINE REQUEST ERROR:",
            error
        );

        if (errorMessage) {

            errorMessage.textContent =
                "Unable to submit your decline. Please try again.";

        }

    }

}


// =====================================================
// MODAL BUTTONS
// =====================================================

function setupDeclineModal() {

    const closeButton =
        document.getElementById(
            "closeModal"
        );

    const submitButton =
        document.getElementById(
            "submitDecline"
        );

    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeDeclineModal
        );

    }

    if (submitButton) {

        submitButton.addEventListener(
            "click",
            submitDecline
        );

    }


    // Close when clicking outside modal
    const modal =
        document.getElementById(
            "declineModal"
        );

    if (modal) {

        modal.addEventListener(
            "click",
            (event) => {

                if (
                    event.target === modal
                ) {

                    closeDeclineModal();

                }

            }
        );

    }

}


// =====================================================
// START MODAL SETUP
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupDeclineModal();

    }
);


// =====================================================
// STATUS INFORMATION
// =====================================================

function getStatusInfo(status) {

    switch (status) {

        case "pending":

            return {
                text: "Pending",
                className: "status-pending"
            };


        case "accepted":

            return {
                text: "Accepted",
                className: "status-accepted"
            };


        case "declined_pending_review":

            return {
                text:
                    "Declined - For Admin Review",

                className:
                    "status-declined"
            };


        case "declined":

            return {
                text:
                    "Declined - Confirmed",

                className:
                    "status-declined"
            };


        default:

            return {
                text:
                    status || "Unknown",

                className:
                    "status-unknown"
            };

    }

}


// =====================================================
// TIME FORMATTER
// =====================================================

function formatTime(time) {

    if (!time) {
        return "--";
    }

    const parts =
        String(time).split(":");

    if (parts.length < 2) {
        return time;
    }

    let hour =
        parseInt(parts[0], 10);

    const minute =
        parts[1];

    const suffix =
        hour >= 12
            ? "PM"
            : "AM";

    hour =
        hour % 12 || 12;

    return `${hour}:${minute} ${suffix}`;

}


// =====================================================
// BASIC HTML ESCAPING
// =====================================================

function escapeHTML(value) {

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
