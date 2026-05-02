import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already authenticated
    if (pb.authStore.isValid) {
      setCurrentUser(pb.authStore.model);
    }
    setInitialLoading(false);
  }, []);

  const login = async (email, password) => {
    const authData = await pb.collection('users').authWithPassword(email, password, { $autoCancel: false });
    setCurrentUser(authData.record);
    return authData;
  };

  const signup = async (email, password, passwordConfirm, name) => {
    const user = await pb.collection('users').create({
      email,
      password,
      passwordConfirm,
      name: name || ''
    }, { $autoCancel: false });
    
    // Auto-login after signup
    const authData = await pb.collection('users').authWithPassword(email, password, { $autoCancel: false });
    setCurrentUser(authData.record);
    return authData;
  };

  const logout = () => {
    pb.authStore.clear();
    setCurrentUser(null);
    navigate('/login');
  };

  // Broker credentials management
  const saveBrokerCredentials = async (apiKey, apiSecret, brokerName) => {
    if (!currentUser) throw new Error('User not authenticated');
    
    // Save to broker_credentials collection
    await pb.collection('broker_credentials').create({
      user_id: currentUser.id,
      api_key: apiKey,
      api_secret: apiSecret,
      broker_name: brokerName
    }, { $autoCancel: false });
    
    // Also update user profile for quick access
    const updatedUser = await pb.collection('users').update(currentUser.id, {
      broker_api_key: apiKey,
      broker_api_secret: apiSecret,
      broker_name: brokerName
    }, { $autoCancel: false });
    
    setCurrentUser(updatedUser);
  };

  const getBrokerCredentials = async () => {
    if (!currentUser) return null;
    
    const credentials = await pb.collection('broker_credentials').getFullList({
      filter: `user_id = "${currentUser.id}"`,
      $autoCancel: false
    });
    
    return credentials;
  };

  const updateUserSettings = async (settings) => {
    if (!currentUser) throw new Error('User not authenticated');
    
    const updatedUser = await pb.collection('users').update(currentUser.id, settings, { $autoCancel: false });
    setCurrentUser(updatedUser);
    return updatedUser;
  };

  const value = {
    currentUser,
    login,
    signup,
    logout,
    saveBrokerCredentials,
    getBrokerCredentials,
    updateUserSettings,
    isAuthenticated: !!currentUser
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};