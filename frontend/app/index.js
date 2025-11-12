import React, { useState } from "react";
import { View, Text, Button, Image, StyleSheet, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import axios from "axios";

export default function HomeScreen() {
  const [photo, setPhoto] = useState(null);
  const [location, setLocation] = useState(null);

  // ✅ Pick image from camera
  const pickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      return Alert.alert("Camera Permission Needed");
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      setPhoto(result.assets[0]);
    }
  };

  // ✅ Get GPS
  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      return Alert.alert("Location Permission Needed");
    }

    const loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
  };

  // ✅ Upload image + GPS
  const uploadNow = async () => {
    if (!photo || !location) {
      return Alert.alert("Please capture photo & location first.");
    }

    const formData = new FormData();
    formData.append("photo", {
      uri: photo.uri,
      name: "proof.jpg",
      type: "image/jpeg",
    });

    formData.append("lat", location.latitude.toString());
    formData.append("lng", location.longitude.toString());

    try {
      const res = await axios.post(
        "http://172.21.60.106:3000/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      Alert.alert("✅ Upload Success", JSON.stringify(res.data));
    } catch (error) {
      Alert.alert("❌ Upload Failed", error.message);
      console.log(error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>✅ Working Upload Form</Text>

      {photo && <Image source={{ uri: photo.uri }} style={styles.img} />}

      <Button title="📷 Capture Photo" onPress={pickImage} />
      <Button title="📍 Get Location" onPress={getLocation} />
      <Button title="⬆️ Upload" onPress={uploadNow} />

      {location && (
        <Text style={styles.text}>
          Lat: {location.latitude} | Lng: {location.longitude}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  heading: { fontSize: 22, marginBottom: 20 },
  img: { width: 300, height: 300, marginVertical: 10 },
  text: { marginTop: 20 },
});
