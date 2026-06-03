
const firebaseConfig = {
    apiKey: "AIzaSyD1tRtZYYnleMWUXkJF9n7E1FIcAt5Fgzc",
    authDomain: "professorjackson-f41a2.firebaseapp.com",
    projectId: "professorjackson-f41a2",
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const storage = firebase.storage();