import * as core from "@actions/core";
import * as github from "@actions/github";

type DeploymentState =
  | "error"
  | "failure"
  | "inactive"
  | "in_progress"
  | "queued"
  | "pending"
  | "success";

async function run() {
  try {
    const context = github.context;

    const pr = core.getInput("pr", { required: false }) === "true";
    const prId = core.getInput("pr_id", {required: false}) || 0;

    const logUrl = pr ?
      `https://github.com/${context.repo.owner}/${context.repo.repo}/pull/${prId}/checks` :
      `https://github.com/${context.repo.owner}/${context.repo.repo}/commit/${context.sha}/checks`;

    const token = core.getInput("token", { required: true });
    const ref = core.getInput("ref", { required: false }) || context.ref;
    const url = core.getInput("target_url", { required: false }) || logUrl;
    const payload = JSON.parse(`{"web_url": "${url}"}`)
    const environment = core.getInput("environment", { required: false }) || "production";
    const description = core.getInput("description", { required: false });

    let deploymentId = parseFloat(core.getInput("deployment_id", { required: false }) || "0")

    const status: DeploymentState = (core.getInput("status", { required: false }) as DeploymentState) || "pending";
    const autoMerge = core.getInput("auto_merge", { required: false }) === "true";
    const transientEnvironment = core.getInput("transient_environment", { required: false }) === "true"

    const octokit = github.getOctokit(token)

    if (!deploymentId || deploymentId === 0) {
      const deployment = await octokit.rest.repos.createDeployment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: ref,
        payload,
        required_contexts: [],
        environment,
        transient_environment: transientEnvironment,
        auto_merge: autoMerge,
        description
      });

      if(deployment.status !== 201){
        throw new Error(`Failed to create deployment: ${deployment.status}`);
      }

      deploymentId = deployment.data.id;
    }

    const deploymentStatus = await octokit.rest.repos.createDeploymentStatus({
      ...context.repo,
      deployment_id: deploymentId,
      state: status,
      log_url: logUrl,
      environment_url: url,
      description
    });

    if(deploymentStatus.status !== 201){
      throw new Error(`Failed to create deployment status: ${deploymentStatus.status}`);
    }

    core.setOutput("deployment_id", deploymentId);
  } catch (error: any) {
    core.error(error);
    core.setFailed(error.message);
  }
}

run();
