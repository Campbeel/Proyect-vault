import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: "https://sepolia.infura.io/v3/47df9777b0fe429686e584a221fc8221",
      accounts: ["f68d41d0585f3329ee3cb517f7a96bb5194bd4212d37c2b9691533fbab8bd13e"]
    }
  }
};

export default config;
