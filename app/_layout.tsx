import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Slot } from 'expo-router';
import { useRouter } from 'expo-router';

const Layout: React.FC = () => {
    const router = useRouter();
    useEffect(() => {
        router.push('/home');
    }, [router]);
    return (
        <View style={{ flex: 1 }}>
            <Slot />
        </View>
    );
};

export default Layout;
