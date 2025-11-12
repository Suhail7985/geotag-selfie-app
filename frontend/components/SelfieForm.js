import React, { useState } from "react";
import { View, Text, Button, Image, Alert, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import axios from "axios";

export default function SelfieForm() {
  const [photo, setPhoto] = useState(null);

  const takeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera permission denied");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      base64: false,
    });

    if (!result.canceled) {
      setPhoto(result.assets[0]);
    }
  };

  const uploadSelfie = async () => {
    if (!photo) {
      Alert.alert("Take a selfie first!");
      return;
    }

    const locPermission = await Location.requestForegroundPermissionsAsync();
    if (locPermission.status !== "granted") {
      Alert.alert("Location permission denied");
      return;
    }

    const loc = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = loc.coords;

    let formData = new FormData();
    formData.append("lat", latitude);
    formData.append("lng", longitude);

    formData.append("photo", {
      uri: photo.uri,
      name: "selfie.jpg",
      type: "image/jpeg",
    });

    try {
      const res = await axios.post(
        "http://172.21.60.106:3000/upload",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      Alert.alert("Success", JSON.stringify(res.data, null, 2));
    } catch (err) {
      console.log(err);
      Alert.alert("Upload failed", "Check backend logs");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Geo Selfie Verification</Text>

      <Button title="Take Selfie" onPress={takeSelfie} />

      {photo && (
        <Image source={{ uri: photo.uri }} style={styles.preview} />
      )}

      <Button title="Upload Selfie" onPress={uploadSelfie} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    marginTop: 60
  },
  heading: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center"
  },
  preview: {
    width: "100%",
    height: 350,
    marginVertical: 20,
    borderRadius: 10
  }
});
