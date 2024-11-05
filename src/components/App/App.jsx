import React, { useEffect } from 'react';
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

import AboutPage from '../AboutPage/AboutPage';
// import UserPage from '../1UserPage/UserPage';
// import YourRoutePage from '../2YourRoutePage/YourRoutePage';
// import ClientVisitPage from '../3ClientVisitPage/ClientVisitPage';
// import AdminLandingPage from '../4AdminLandingPage/AdminLandingPage';
// import AdminClientListPage from '../5AdminClientListPage/AdminClientListPage';
// import AdminTimelyNotePage from '../6AdminTimelyNotePage/AdminTimelyNotePage';
// import AdminFieldTechListPage from '../7AdminFieldTechListPage/AdminFieldTechListPage';
// import AdminDataEntryPage from '../8AdminDataEntryPage/AdminDataEntryPage';

import InfoPage from '../InfoPage/InfoPage';
import LandingPage from '../LandingPage/LandingPage';
import LoginPage from '../LoginPage/LoginPage';
import RegisterPage from '../RegisterPage/RegisterPage';

import './App.css';

function App() {
  const dispatch = useDispatch();

  const user = useSelector(store => store.user);

  useEffect(() => {
    dispatch({ type: 'FETCH_USER' });
  }, [dispatch]);

  return (
    <Router>
      <div>
        <Nav />
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
            <AdminFieldTechList />
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
        <Footer />
      </div>
    </Router> 
          
  );
}

export default App;
