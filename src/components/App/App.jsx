import React, { useEffect, Suspense, lazy } from 'react';
import {
  HashRouter as Router,
  Redirect,
  Route,
  Switch,
} from 'react-router-dom';

import { useDispatch, useSelector } from 'react-redux';

import Nav from '../Nav/Nav';
import Footer from '../Footer/Footer';

import ProtectedRoute from '../ProtectedRoute/ProtectedRoute';

// Route-level code splitting via React.lazy
const AboutPage = lazy(() => import('../AboutPage/AboutPage'));
const UserPage = lazy(() => import('../1UserPage/UserPage'));
const YourRoutePage = lazy(() => import('../2YourRoutePage/YourRoutePage'));
const ClientVisitPage = lazy(() => import('../3ClientVisitPage/ClientVisitPage'));
const AdminLandingPage = lazy(() => import('../4AdminLandingPage/AdminLandingPage'));
const AdminClientListPage = lazy(() => import('../5AdminClientListPage/AdminClientListPage'));
const AdminTimelyNotePage = lazy(() => import('../6AdminTimelyNotesPage/AdminTimelyNotesPage'));
const AdminFieldTechListPage = lazy(() => import('../7AdminFieldTechListPage/AdminFieldTechListPage'));
const AdminDataEntryPage = lazy(() => import('../8AdminDataEntryPage/AdminDataEntryPage'));
const InfoPage = lazy(() => import('../InfoPage/InfoPage'));
const LandingPage = lazy(() => import('../LandingPage/LandingPage'));
const LoginPage = lazy(() => import('../LoginPage/LoginPage'));
const RegisterPage = lazy(() => import('../RegisterPage/RegisterPage'));

import './App.css';




function App() {
  const dispatch = useDispatch();

  const user = useSelector(store => store.user);

  useEffect(() => {
    dispatch({ type: 'FETCH_USER' });
  }, [dispatch]);

  // Prefetch likely next routes once user is known (helps perceived perf)
  useEffect(() => {
    if (user?.id) {
      // fire-and-forget dynamic imports to warm chunks
      import('../2YourRoutePage/YourRoutePage');
      import('../3ClientVisitPage/ClientVisitPage');
    }
  }, [user?.id]);

  // Line 45 begins the "Front-End" Router
  return (
    <Router>
      <div>
        <Nav />
        <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
          <Switch>
          {/* Visiting localhost:5173 will redirect to localhost:5173/home */}
          <Redirect exact from="/" to="/home" />
          {/* For protected routes, the view could show one of several things on the same route. Visiting localhost:5173/user will show the UserPage if the user is logged in. If the user is not logged in, the ProtectedRoute will show the LoginPage (component). Even though it seems like they are different pages, the user is always on localhost:5173/user */}


          <ProtectedRoute  // AdminDataEntry
            // logged in shows AdminDataEntryPage else shows LoginPage
            exact
            path="/AdminDataEntryPage"
          >
            <AdminDataEntryPage />
          </ProtectedRoute>

          <ProtectedRoute  // AdminFieldTechList
            // logged in shows AdminFieldTechList else shows LoginPage
            exact
            path="/AdminFieldTechList"
          >
            <AdminFieldTechListPage />
          </ProtectedRoute>

          <ProtectedRoute  // AdminTimelyNote
            // logged in shows AdminTimelyNotePage else shows LoginPage
            exact
            path="/AdminTimelyNotePage"
          >
            <AdminTimelyNotePage />
          </ProtectedRoute>

          <ProtectedRoute  // AdminClientList
            // logged in shows AdminClientListPage else shows LoginPage
            exact
            path="/AdminClientListPage"
          >
            <AdminClientListPage/>
          </ProtectedRoute>

          <ProtectedRoute  // AdminLanding
            // logged in shows AdminLandingPage else shows LoginPage
            exact
            path="/AdminLandingPage"
          >
            <AdminLandingPage/>
          </ProtectedRoute>

          <ProtectedRoute  // ClientVisit
            // logged in shows ClientVisitPage else shows LoginPage
            exact
            path="/ClientVisitPage"
          >
            <ClientVisitPage />
          </ProtectedRoute> 

          <ProtectedRoute  // YourRoute
            // logged in shows YourRoutePage else shows LoginPage
            exact
            path="/YourRoutePage"
          >
            <YourRoutePage />
          </ProtectedRoute>  

          <ProtectedRoute  // user
            // logged in shows UserPage else shows LoginPage
            exact
            path="/user"
          >
            <UserPage />
          </ProtectedRoute>

          <ProtectedRoute // info
            // logged in shows InfoPage else shows LoginPage
            exact
            path="/info"
          >
            <InfoPage />
          </ProtectedRoute> 

          <Route  //log-in
            exact
            path="/login"
          >
            {user.id ?
              // If the user is already logged in, 
              // redirect to the /user page
              <Redirect to="/user" />
              :
              // Otherwise, show the login page
              <LoginPage />
            }
          </Route>

          <Route  // register
            exact
            path="/registration"
          >
            {user.id ?
              // If the user is already logged in, 
              // redirect them to the /user page
              <Redirect to="/user" />
              :
              // Otherwise, show the registration page
              <RegisterPage />
            }
          </Route>

          <Route  // home
            exact
            path="/home"
          >
            {user.id ?
              // If the user is already logged in, 
              // redirect them to the /user page
              <Redirect to="/user" />
              :
              // Otherwise, show the Landing page
              <LandingPage />
            }
          </Route>  

          {/* Visiting localhost:5173/about will show the about page. */}
          <Route  // about
            // shows AboutPage at all times (logged in or not)
            exact
            path="/about"
          >
            <AboutPage />
          </Route>

          {/* If none of the other routes matched, we will show a 404. */}
          <Route  // 404 
          >  
            <h1>404</h1>
          </Route>

          </Switch>
        </Suspense>
        <Footer />
      </div>
    </Router> 
          
  );
}

export default App;
