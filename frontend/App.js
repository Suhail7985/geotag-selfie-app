import React, { useState } from "react";
import { View, Text, Button, Image, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

export default function App() {
  const [photo, setPhoto] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      setPhoto(result.assets[0]);
    }
  };

  const getLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      alert("Permission denied");
      return;
    }

    let loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
  };

  const uploadData = async () => {
    if (!photo || !location) {
      alert("Pick image + get location first!");
      return;
    }

    setLoading(true);

    let formData = new FormData();
    formData.append("photo", {
      uri: photo.uri,
      type: "image/jpeg",
      name: "upload.jpg",
    });

    formData.append("lat", location.latitude.toString());
    formData.append("lng", location.longitude.toString());

    try {
      const res = await fetch("http://172.21.60.106:3000/upload", {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      const data = await res.json();
      console.log(data);
      alert("Uploaded!");
    } catch (err) {
      console.log(err);
      alert("Error uploading");
    }

    setLoading(false);
  };

  return (
    <View style={{ padding: 20, marginTop: 60 }}>
      <Text style={{ fontSize: 24, fontWeight: "bold" }}>Frontend Test</Text>

      <Button title="Pick Photo" onPress={pickImage} />

      {photo && (
        <Image
          source={{ uri: photo.uri }}
          style={{ width: 200, height: 200, marginVertical: 20 }}
        />
      )}

      <Button title="Get GPS Location" onPress={getLocation} />

      {location && (
        <Text style={{ marginVertical: 10 }}>
          Location: {location.latitude}, {location.longitude}
        </Text>
      )}

      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 20 }} />
      ) : (
        <Button title="Upload" onPress={uploadData} />
      )}
    </View>
  );
}
