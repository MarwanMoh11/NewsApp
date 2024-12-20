import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import { UserProvider } from '../app/UserContext'; // Adjust the path to where your UserContext file is located

const Layout: React.FC = () => {
    const router = useRouter();

    useEffect(() => {
    }, [router]);

    return (
        <UserProvider>
            <View style={{ flex: 1 }}>
                <Slot />
            </View>
        </UserProvider>
    );
};

export default Layout;
