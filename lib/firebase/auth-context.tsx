'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from './client';
import type { BaseUserProfile, Organization, OrganizationMembership, UserProfile } from '@/lib/domain/types';

interface AuthContextValue {
  firebaseUser: User | null;
  baseProfile: BaseUserProfile | null;
  profile: UserProfile | null;
  activeOrganization: Organization | null;
  activeMembership: OrganizationMembership | null;
  loading: boolean;
  authLoading: boolean;
  profileLoading: boolean;
  profileChecked: boolean;
  profileError: string | null;
  signOutUser: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [baseProfile, setBaseProfile] = useState<BaseUserProfile | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [activeMembership, setActiveMembership] = useState<OrganizationMembership | null>(null);

  const [authLoading, setAuthLoading] = useState(true);
  const [userDocLoading, setUserDocLoading] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setFirebaseUser(user);
      setAuthLoading(false);
      setUserDocLoading(Boolean(user));
      setWorkspaceLoading(false);
      setBaseProfile(null);
      setProfile(null);
      setActiveOrganization(null);
      setActiveMembership(null);
      setProfileError(null);
      setProfileChecked(!user);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!firebaseUser) {
      setBaseProfile(null);
      setUserDocLoading(false);
      setProfileChecked(true);
      return undefined;
    }

    setUserDocLoading(true);
    setProfileChecked(false);
    setProfileError(null);

    const ref = doc(db, 'users', firebaseUser.uid);
    const unsubscribe = onSnapshot(
      ref,
      snapshot => {
        if (!snapshot.exists()) {
          setBaseProfile(null);
          setProfile(null);
          setActiveOrganization(null);
          setActiveMembership(null);
          setProfileError('Signed in, but no SaaS user profile exists at users/{uid}. Run the seed script or create the user through an organization admin.');
          setProfileChecked(true);
        } else {
          const data = snapshot.data() as Omit<BaseUserProfile, 'uid'>;
          setBaseProfile({ uid: snapshot.id, ...data });
        }
        setUserDocLoading(false);
      },
      error => {
        console.error('Failed to load SaaS user profile:', error);
        setProfileError(error.message);
        setBaseProfile(null);
        setProfile(null);
        setUserDocLoading(false);
        setProfileChecked(true);
      }
    );

    return unsubscribe;
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || userDocLoading) return undefined;

    if (!baseProfile) {
      setWorkspaceLoading(false);
      setProfile(null);
      setActiveOrganization(null);
      setActiveMembership(null);
      setProfileChecked(true);
      return undefined;
    }

    const activeOrgId = baseProfile.activeOrgId || baseProfile.orgIds?.[0];

    if (!activeOrgId) {
      setWorkspaceLoading(false);
      setProfile(null);
      setActiveOrganization(null);
      setActiveMembership(null);
      setProfileError('Your account exists, but it is not attached to any organization workspace yet.');
      setProfileChecked(true);
      return undefined;
    }

    setWorkspaceLoading(true);
    setProfileChecked(false);
    setProfileError(null);

    let orgLoaded = false;
    let memberLoaded = false;
    let orgData: Organization | null = null;
    let memberData: OrganizationMembership | null = null;

    function finish() {
      if (!orgLoaded || !memberLoaded) return;

      setActiveOrganization(orgData);
      setActiveMembership(memberData);

      if (!orgData) {
        setProfile(null);
        setProfileError(`The selected organization (${activeOrgId}) does not exist.`);
      } else if (!memberData) {
        setProfile(null);
        setProfileError(`You are not a member of the selected organization (${orgData.name}).`);
      } else {
        setProfile({
          uid: firebaseUser!.uid,
          email: baseProfile?.email || memberData.email || firebaseUser!.email || '',
          fullName: baseProfile?.fullName || memberData.fullName || firebaseUser!.displayName || 'User',
          active: baseProfile?.active !== false && memberData.active !== false && orgData.status !== 'suspended',
          role: memberData.role,
          activeOrgId: activeOrgId!,
          activeOrgName: orgData.name,
          orgIds: baseProfile?.orgIds,
          createdAt: baseProfile?.createdAt,
          updatedAt: baseProfile?.updatedAt,
          lastLoginAt: baseProfile?.lastLoginAt
        });
        setProfileError(null);
      }

      setWorkspaceLoading(false);
      setProfileChecked(true);
    }

    const orgRef = doc(db, 'organizations', activeOrgId);
    const memberRef = doc(db, 'organizations', activeOrgId, 'members', firebaseUser.uid);

    const unsubscribeOrg = onSnapshot(
      orgRef,
      snapshot => {
        orgLoaded = true;
        orgData = snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Organization) : null;
        finish();
      },
      error => {
        console.error('Failed to load organization:', error);
        orgLoaded = true;
        orgData = null;
        setProfileError(error.message);
        finish();
      }
    );

    const unsubscribeMember = onSnapshot(
      memberRef,
      snapshot => {
        memberLoaded = true;
        memberData = snapshot.exists()
          ? ({ id: snapshot.id, orgId: activeOrgId, orgName: orgData?.name || '', ...snapshot.data() } as OrganizationMembership)
          : null;
        finish();
      },
      error => {
        console.error('Failed to load organization membership:', error);
        memberLoaded = true;
        memberData = null;
        setProfileError(error.message);
        finish();
      }
    );

    return () => {
      unsubscribeOrg();
      unsubscribeMember();
    };
  }, [baseProfile, firebaseUser, userDocLoading]);

  const signOutUser = useCallback(() => signOut(auth), []);

  const switchOrganization = useCallback(async (orgId: string) => {
    if (!auth.currentUser) throw new Error('Sign in required.');
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      activeOrgId: orgId,
      updatedAt: serverTimestamp()
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    firebaseUser,
    baseProfile,
    profile,
    activeOrganization,
    activeMembership,
    loading: authLoading || userDocLoading || workspaceLoading,
    authLoading,
    profileLoading: userDocLoading || workspaceLoading,
    profileChecked,
    profileError,
    signOutUser,
    switchOrganization
  }), [
    activeMembership,
    activeOrganization,
    authLoading,
    baseProfile,
    firebaseUser,
    profile,
    profileChecked,
    profileError,
    signOutUser,
    switchOrganization,
    userDocLoading,
    workspaceLoading
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
